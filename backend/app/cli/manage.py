"""ResuMate admin CLI.

Usage (from the backend/ directory):
    python -m app.cli.manage create-user --email a@b.com --password pw [--admin]
    python -m app.cli.manage delete-user --email a@b.com
    python -m app.cli.manage list-users
    python -m app.cli.manage rotate-encryption-key --old-key K1 --new-key K2
    python -m app.cli.manage verify-migration --admin-email a@b.com
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models.user import User
from app.services import auth_service


async def _create_user(email: str, password: str, admin: bool) -> None:
    email = email.lower().strip()
    async with SessionLocal() as db:  # type: AsyncSession
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            print(f"[error] user already exists: {email}", file=sys.stderr)
            sys.exit(1)

        if admin:
            admin_exists = await db.execute(select(User).where(User.is_admin.is_(True)))
            if admin_exists.scalar_one_or_none():
                print(
                    "[error] an admin user already exists. Refusing to create a second. "
                    "Use delete-user first if this is intentional.",
                    file=sys.stderr,
                )
                sys.exit(1)

        user = User(
            id=str(uuid4()),
            email=email,
            password_hash=auth_service.hash_password(password),
            is_admin=admin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        print(f"Created user {email} (id={user.id}, admin={admin})")


async def _delete_user(email: str) -> None:
    email = email.lower().strip()
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            print(f"[error] no user with email: {email}", file=sys.stderr)
            sys.exit(1)
        await db.delete(user)
        await db.commit()
        print(f"Deleted user {email}")


async def _list_users() -> None:
    async with SessionLocal() as db:
        result = await db.execute(select(User).order_by(User.created_at))
        users = result.scalars().all()
        if not users:
            print("(no users)")
            return
        print(f"{'EMAIL':40}  {'ADMIN':6}  {'ACTIVE':6}  ID")
        for u in users:
            print(f"{u.email:40}  {str(u.is_admin):6}  {str(u.is_active):6}  {u.id}")


async def _rotate_encryption_key(old_key: str, new_key: str) -> None:
    from cryptography.fernet import Fernet
    from app.models.user_setting import UserSetting
    from app.services import encryption_service

    old = Fernet(old_key.encode())
    new = Fernet(new_key.encode())
    prefix = "enc::"

    async with SessionLocal() as db:
        result = await db.execute(select(UserSetting))
        rows = result.scalars().all()
        rotated = 0
        for s in rows:
            val = s.setting_value or ""
            if not val.startswith(prefix):
                continue
            try:
                plain = old.decrypt(val[len(prefix):].encode()).decode()
            except Exception as e:
                print(f"[warn] could not decrypt {s.setting_key} with old key: {e}")
                continue
            s.setting_value = prefix + new.encrypt(plain.encode()).decode()
            rotated += 1
        await db.commit()
    print(f"Rotated {rotated} encrypted values. Update ENCRYPTION_KEY in .env to the new key.")
    # Force the process to exit cleanly (avoids accidental reuse of module-level Fernet).
    _ = encryption_service


async def _verify_migration(admin_email: str) -> None:
    """Sanity check after the Phase 5 data migration runs."""
    from sqlalchemy import func
    from app.models.application import Application
    from app.models.user_setting import UserSetting
    from app.models.user_context import UserContext
    from app.models.resume_template import ResumeTemplate
    from app.models.tailor_rule import TailorRule
    from app.models.master_resume import MasterResume
    from app.models.context_file import ContextFile

    async with SessionLocal() as db:
        res = await db.execute(select(User).where(User.email == admin_email.lower()))
        admin = res.scalar_one_or_none()
        if admin is None:
            print(f"[FAIL] admin {admin_email} not found")
            sys.exit(1)
        print(f"[OK]   admin {admin_email} exists (id={admin.id})")

        for name, model in [
            ("applications", Application),
            ("user_settings", UserSetting),
            ("user_context", UserContext),
            ("resume_templates", ResumeTemplate),
            ("tailor_rules", TailorRule),
        ]:
            total = (await db.execute(select(func.count()).select_from(model))).scalar_one()
            nulls = (await db.execute(
                select(func.count()).select_from(model).where(model.user_id.is_(None))
            )).scalar_one()
            print(f"[{'OK' if nulls == 0 else 'FAIL'}]   {name}: {total} rows, {nulls} with NULL user_id")

        mr = (await db.execute(select(MasterResume).where(MasterResume.user_id == admin.id))).scalar_one_or_none()
        print(f"[{'OK' if mr and mr.yaml_content else 'WARN'}]   master_resume: {'present, non-empty' if mr and mr.yaml_content else 'missing or empty'}")

        cf_count = (await db.execute(
            select(func.count()).select_from(ContextFile).where(ContextFile.user_id == admin.id)
        )).scalar_one()
        print(f"[INFO] context_files for admin: {cf_count}")


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="manage")
    sub = p.add_subparsers(dest="cmd", required=True)

    mc = sub.add_parser("migrate-to-cloud",
                        help="Copy SQLite data to Postgres and PDFs to R2")
    mc.add_argument("--sqlite-path", required=True,
                    help="Path to the local resumate.db file")
    mc.add_argument("--target-url", required=True,
                    help="asyncpg DATABASE_URL for the target Postgres DB")

    cu = sub.add_parser("create-user")
    cu.add_argument("--email", required=True)
    cu.add_argument("--password", required=True)
    cu.add_argument("--admin", action="store_true")

    du = sub.add_parser("delete-user")
    du.add_argument("--email", required=True)

    sub.add_parser("list-users")

    rk = sub.add_parser("rotate-encryption-key")
    rk.add_argument("--old-key", required=True)
    rk.add_argument("--new-key", required=True)

    vm = sub.add_parser("verify-migration")
    vm.add_argument("--admin-email", required=True)

    return p


def main() -> None:
    args = _build_parser().parse_args()
    if args.cmd == "migrate-to-cloud":
        from app.cli.migrate_to_cloud import run_migration
        asyncio.run(run_migration(args.sqlite_path, args.target_url))
    elif args.cmd == "create-user":
        asyncio.run(_create_user(args.email, args.password, args.admin))
    elif args.cmd == "delete-user":
        asyncio.run(_delete_user(args.email))
    elif args.cmd == "list-users":
        asyncio.run(_list_users())
    elif args.cmd == "rotate-encryption-key":
        asyncio.run(_rotate_encryption_key(args.old_key, args.new_key))
    elif args.cmd == "verify-migration":
        asyncio.run(_verify_migration(args.admin_email))


if __name__ == "__main__":
    main()
