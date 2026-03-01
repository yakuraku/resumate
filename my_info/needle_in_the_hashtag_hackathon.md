## IMPORTANT: I ranked 4th in the Hackathon competition

## Competition information:
Needle In The Hashtag
The eSafety Hackathon Competition run by MLAI, eSafety Commissioner and University of Melborune

Description
Here is the rewritten version, in a Markdown code block, preserving the original tone and structure while replacing user-level classification with record-level multilabel prediction.

Description
1. Why are we doing this?
Online spaces are messy.

Some accounts are kind and supportive.
Some are just chatting about everyday stuff.
Some show patterns that might worry safety teams:
harassment or bullying,
extremist material,
disordered-eating promotion,
conspiracy theories and misinformation.
Humans can’t read everything, all the time.
We need tools that can highlight the most worrying pieces of content so humans can review them.

This competition gives you a tiny, fake social network where you can practise:

turning raw text into something a model can use,
thinking about record-level signals rather than isolated keywords,
and working with a scoring system that cares about catching risky material and assigning the correct harm types.
2. The little synthetic social network
In this world:

We have a bunch of bot users.
Each bot writes short posts and comments.
Each message can include one or more persona tags drawn from thirteen classes:
benign, recovery_ed,
ed_risk, pro_ana,
bullying, hate_speech, incel_misogyny,
extremist,
misinfo, conspiracy,
gamergate, alpha, trad.
The task is not to group users.
We care about the individual message.

Each record may carry multiple persona labels.
For scoring, the thirteen personas map into three broader risk tiers, but your predictions must remain at the persona level.

All of this is:

synthetic,
compact enough to explore with simple tools,
shaped to feel “real enough” to train practical safety intuition.
3. Data files
To keep things simple, you get three core files.

competition_train.jsonl – labelled training set
A larger sample of messages from the synthetic world.

One record per message.
Useful fields include:
id – record identifier,
user_id – which bot wrote the message,
text – message content,
type – "post" or "comment",
category_labels – the persona labels for that message.
Use this file to test your cleaning, your text representations, and your multilabel modelling.

competition_test.jsonl – test set
Same structure as the training data, but without labels.
This is the set for which you must predict persona labels per record.

sample_submission.csv
A template showing the exact layout your submission must follow.
One row per record id, with one-hot indicators for all thirteen persona classes.

The true labels for the test set are hidden.
They are used by Kaggle and the MLAI app to score your predictions.

4. Your task
For each record in the test set, predict which persona classes apply.
A message may belong to one or several of the thirteen personas.

Work from message-level data, then:

clean and transform the text,
choose how to represent each record,
fit a model that produces multilabel outputs for every message in the test set.
You can follow any modelling strategy you like:

linear models,
tree-based models,
deep architectures,
hybrids or ensembles.
The challenge is simple to state:

Can you recognise the specific harms present in each piece of content?

Submission format
Your CSV should contain one line per record id:

ID,alpha,benign,bullying,conspiracy,ed_risk,extremist,gamergate,hate_speech,incel_misogyny,misinfo,pro_ana,recovery_ed,trad 0,0,1,0,0,0,0,0,0,0,0,0,0,0 1,0,0,0,0,0,0,0,0,1,0,0,0,0 2,0,0,0,0,1,0,0,0,0,0,1,0,0

Each record must have at least one 1.
Multiple 1s per row are valid.
Columns must appear in the exact order shown.
That’s the whole task.

5. Kaggle vs MLAI App
This mini-challenge is part of the MLAI eSafety Hackathon.

On Kaggle:

Use this space to experiment:
upload notebooks,
compare ideas,
get a public leaderboard score.
Kaggle uses a simple accuracy metric (how many users you classify correctly).
On the MLAI app (official):

Final hackathon submissions go here: 👉 https://mlai.au/hackathons
The app uses a risk-aware scoring rule that:
gives you points for correct classifications,
subtracts points for wrong ones,
subtracts extra points if you miss a risky user.
Kaggle = “how well is my model doing in general?”

MLAI app = “how well am I doing under a scoring system that really cares about risky users?”

Evaluation
Evaluation
In this challenge, we keep the original structure but shift from user-level accuracy to a record-level multilabel scoring system that reflects both risk awareness and harm-type specificity. Your work is judged through a combined metric that captures coarse safety detection and fine-grained persona recognition.

1. Kaggle leaderboard metric (practice)
On Kaggle you see a straightforward multilabel score.
Each test record carries one or more persona labels.
Your submission contains one-hot predictions for all thirteen persona classes.

We compare your one-hot predictions with the hidden labels and compute a standard multilabel performance score. This gives you a quick signal about whether your model changes improve or weaken message-level detection.

This metric is only for fast feedback on the public leaderboard.

2. Official hackathon scoring (MLAI app)
For the hackathon, we don’t treat all mistakes equally.
Missing harmful content matters more than being unsure about harmless material, and correctly naming the specific persona adds value for downstream safety teams.
To reflect this, the MLAI app uses a hybrid two-part score.

Coarse tier score (risk awareness)
The thirteen personas map to three broad risk tiers:

benign
recovery
risky
We compute a macro F1 score over these three tiers.
This captures how well your system distinguishes safe, supportive, and harmful content.

Fine persona score (specific harm classification)
We also compute a macro F1 score across all thirteen persona labels.
This rewards models that identify the exact flavour of harm instead of collapsing everything into one bucket.

Final score
The two parts combine into a single number:

FinalScore = 0.70 × Risk_Tier_F1 + 0.30 × Persona_F1

The weighting reflects:

strong emphasis on catching harmful content,
secondary emphasis on naming the specific persona type,
balanced incentives that prevent a “label everything risky” strategy.
3. Why this shape?
Correctly catching harmful material is the core priority.
Risk-tier macro F1 dominates the score because safety evaluation cares about recall for risky classes.
The persona-level component encourages precision and nuance, which helps safety teams route and prioritise responses.
Together they reward systems that are both aware of danger and accurate about its nature.

4. Submission file
Your Kaggle submission is a CSV with one row per record ID.

Required columns:

ID
one column for each of the thirteen persona classes
(alpha, benign, bullying, conspiracy, ed_risk, extremist, gamergate, hate_speech, incel_misogyny, misinfo, pro_ana, recovery_ed, trad)
Each row contains a string of thirteen 0/1 indicators showing which personas apply to that message.

Every record must have at least one 1.

This file is used for both the Kaggle ranking and the MLAI hybrid score.

ID,alpha,benign,bullying,conspiracy,ed_risk,extremist,gamergate,hate_speech,incel_misogyny,misinfo,pro_ana,recovery_ed,trad 0,0,1,0,0,0,0,0,0,0,0,0,0,0 1,0,0,0,0,0,0,0,0,1,0,0,0,0 2,0,0,0,0,1,0,0,0,0,0,1,0,0

## The code that i used:
````
import os
import json
import pandas as pd
import numpy as np
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, 
    AutoModel,
    AutoConfig,
    get_cosine_schedule_with_warmup,
    set_seed
)
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import f1_score
from tqdm.auto import tqdm
import warnings
import ast
warnings.filterwarnings('ignore')

# Force flush output
import sys
sys.stdout.flush()

set_seed(42)

# Configuration
class Config:
    # Paths
    DATA_DIR = Path("data/kaggle_dataset")
    EXAMPLE_TRAIN_FILE = DATA_DIR / "example_train.csv"
    COMP_TRAIN_FILE = DATA_DIR / "competition_train.jsonl"
    TEST_FILE = DATA_DIR / "competition_test.jsonl"
    OUTPUT_DIR = Path("outputs")
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Model
    MODEL_NAME = "microsoft/deberta-v3-large"
    MAX_LENGTH = 256
    
    # Training
    BATCH_SIZE = 16
    GRADIENT_ACCUMULATION = 2
    LEARNING_RATE = 1e-5
    WEIGHT_DECAY = 0.01
    EPOCHS = 4
    WARMUP_RATIO = 0.1
    MAX_GRAD_NORM = 1.0
    
    # Multi-label
    NUM_LABELS = 13
    LABEL_COLS = [
        'alpha', 'benign', 'bullying', 'conspiracy', 'ed_risk', 
        'extremist', 'gamergate', 'hate_speech', 'incel_misogyny', 
        'misinfo', 'pro_ana', 'recovery_ed', 'trad'
    ]
    
    N_FOLDS = 5
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

config = Config()
print(f"Using device: {config.DEVICE}", flush=True)
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None'}", flush=True)

# ==================== DATA LOADING WITH PROPER FORMAT HANDLING ====================

def parse_category_labels(labels):
    """Parse category labels from different formats"""
    if isinstance(labels, list):
        return labels
    elif isinstance(labels, str):
        try:
            return ast.literal_eval(labels)
        except:
            try:
                return json.loads(labels)
            except:
                return [labels]
    return []

def load_csv_train(file_path):
    """Load CSV training file with proper label parsing"""
    df = pd.read_csv(file_path)
    df['category_labels'] = df['category_labels'].apply(parse_category_labels)
    return df

def load_jsonl(file_path):
    """Load JSONL file"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            data.append(json.loads(line.strip()))
    df = pd.DataFrame(data)
    
    # Only parse category_labels if it exists (test data won't have it)
    if 'category_labels' in df.columns:
        df['category_labels'] = df['category_labels'].apply(parse_category_labels)
    
    return df

print("Loading training data...", flush=True)
train_dfs = []

# Load example_train.csv if exists
if config.EXAMPLE_TRAIN_FILE.exists():
    example_df = load_csv_train(config.EXAMPLE_TRAIN_FILE)
    train_dfs.append(example_df)
    print(f"✓ Loaded example_train.csv: {len(example_df)} rows", flush=True)
else:
    print("⚠ example_train.csv not found, skipping...", flush=True)

# Load competition_train.jsonl
if config.COMP_TRAIN_FILE.exists():
    comp_df = load_jsonl(config.COMP_TRAIN_FILE)
    train_dfs.append(comp_df)
    print(f"✓ Loaded competition_train.jsonl: {len(comp_df)} rows", flush=True)
else:
    print("⚠ competition_train.jsonl not found", flush=True)

# Combine datasets
if len(train_dfs) > 1:
    train_df = pd.concat(train_dfs, ignore_index=True)
    print(f"✓ Combined training data: {len(train_df)} rows", flush=True)
elif len(train_dfs) == 1:
    train_df = train_dfs[0]
else:
    raise ValueError("No training data found!")

# Load test data
test_df = load_jsonl(config.TEST_FILE)
print(f"✓ Loaded test data: {len(test_df)} rows", flush=True)

# Verify we have the required columns
required_cols = ['text', 'category_labels']
for col in required_cols:
    if col not in train_df.columns:
        raise ValueError(f"Missing column: {col}")

print(f"\nFinal train shape: {train_df.shape}", flush=True)
print(f"Test shape: {test_df.shape}", flush=True)

# Analyze multi-label distribution
labels_per_sample = train_df['category_labels'].apply(len)
print(f"\nLabels per sample:", flush=True)
print(f"  Mean: {labels_per_sample.mean():.2f}", flush=True)
print(f"  Min: {labels_per_sample.min()}", flush=True)
print(f"  Max: {labels_per_sample.max()}", flush=True)
print(f"  Single label: {(labels_per_sample == 1).sum()} ({(labels_per_sample == 1).sum()/len(train_df)*100:.1f}%)", flush=True)
print(f"  Multi-label: {(labels_per_sample > 1).sum()} ({(labels_per_sample > 1).sum()/len(train_df)*100:.1f}%)", flush=True)

# ==================== PREPROCESSING ====================

def create_multilabel_targets(df, label_cols):
    """Convert category_labels to multi-hot encoding"""
    multilabel_matrix = np.zeros((len(df), len(label_cols)), dtype=np.float32)
    
    for idx, labels in enumerate(df['category_labels']):
        if not isinstance(labels, list):
            labels = [labels]
        for label in labels:
            if label in label_cols:
                col_idx = label_cols.index(label)
                multilabel_matrix[idx, col_idx] = 1.0
    
    return multilabel_matrix

# Create multi-label targets
print("\nCreating multi-label targets...", flush=True)
y_train = create_multilabel_targets(train_df, config.LABEL_COLS)
print(f"\nLabel distribution in training data:", flush=True)
label_counts = pd.DataFrame(y_train, columns=config.LABEL_COLS).sum().sort_values(ascending=False)
for label, count in label_counts.items():
    print(f"  {label}: {int(count)} ({count/len(train_df)*100:.1f}%)", flush=True)

# Calculate class weights for imbalanced dataset
label_counts_arr = y_train.sum(axis=0)
total_samples = len(y_train)
pos_weights = (total_samples - label_counts_arr) / (label_counts_arr + 1e-6)
pos_weights = np.clip(pos_weights, 0.5, 20.0)
pos_weights = torch.FloatTensor(pos_weights).to(config.DEVICE)

print(f"\nClass weights (for handling imbalance):", flush=True)
for label, weight in sorted(zip(config.LABEL_COLS, pos_weights.cpu().numpy()), key=lambda x: x[1], reverse=True)[:5]:
    print(f"  {label}: {weight:.2f}", flush=True)

# ==================== DATASET ====================

class MultiLabelTextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_length):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = str(self.texts[idx])
        
        encoding = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_attention_mask=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.FloatTensor(self.labels[idx])
        }

# ==================== MODEL ====================

class MultiLabelClassifier(nn.Module):
    def __init__(self, model_name, num_labels, dropout=0.1):
        super().__init__()
        self.config = AutoConfig.from_pretrained(model_name)
        self.transformer = AutoModel.from_pretrained(model_name, config=self.config)
        
        # Multi-label classification head with layer norm
        self.dropout = nn.Dropout(dropout)
        self.layer_norm = nn.LayerNorm(self.config.hidden_size)
        self.classifier = nn.Linear(self.config.hidden_size, num_labels)
        
        self._init_weights(self.classifier)
    
    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            module.weight.data.normal_(mean=0.0, std=self.config.initializer_range)
            if module.bias is not None:
                module.bias.data.zero_()
    
    def forward(self, input_ids, attention_mask):
        outputs = self.transformer(
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        
        pooled_output = outputs.last_hidden_state[:, 0, :]
        pooled_output = self.layer_norm(pooled_output)
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        
        return logits

# ==================== TRAINING ====================

def train_epoch(model, dataloader, optimizer, scheduler, criterion, device, gradient_accumulation):
    model.train()
    total_loss = 0
    optimizer.zero_grad()
    
    pbar = tqdm(dataloader, desc='Training')
    for step, batch in enumerate(pbar):
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        
        logits = model(input_ids, attention_mask)
        loss = criterion(logits, labels)
        loss = loss / gradient_accumulation
        loss.backward()
        
        if (step + 1) % gradient_accumulation == 0:
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.MAX_GRAD_NORM)
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
        
        total_loss += loss.item() * gradient_accumulation
        pbar.set_postfix({'loss': f'{loss.item() * gradient_accumulation:.4f}'})
    
    return total_loss / len(dataloader)

def validate(model, dataloader, criterion, device, threshold=0.5):
    model.eval()
    total_loss = 0
    all_preds = []
    all_labels = []
    all_probs = []
    
    with torch.no_grad():
        for batch in tqdm(dataloader, desc='Validating'):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['labels'].to(device)
            
            logits = model(input_ids, attention_mask)
            loss = criterion(logits, labels)
            
            probs = torch.sigmoid(logits)
            preds = (probs > threshold).float()
            
            total_loss += loss.item()
            all_preds.append(preds.cpu().numpy())
            all_labels.append(labels.cpu().numpy())
            all_probs.append(probs.cpu().numpy())
    
    all_preds = np.vstack(all_preds)
    all_labels = np.vstack(all_labels)
    all_probs = np.vstack(all_probs)
    
    # Ensure at least one prediction per sample
    for i in range(len(all_preds)):
        if all_preds[i].sum() == 0:
            all_preds[i, np.argmax(all_probs[i])] = 1
    
    # Calculate macro F1
    f1_per_class = []
    for i in range(all_labels.shape[1]):
        f1 = f1_score(all_labels[:, i], all_preds[:, i], zero_division=0)
        f1_per_class.append(f1)
    
    macro_f1 = np.mean(f1_per_class)
    
    return total_loss / len(dataloader), macro_f1, f1_per_class

# ==================== MAIN TRAINING LOOP ====================

print("\n" + "="*70, flush=True)
print("INITIALIZING TRAINING", flush=True)
print("="*70, flush=True)

print("Loading tokenizer...", flush=True)
tokenizer = AutoTokenizer.from_pretrained(config.MODEL_NAME)
print("✓ Tokenizer loaded", flush=True)

# Create stratified folds based on dominant label
y_dominant = np.argmax(y_train, axis=1)
skf = StratifiedKFold(n_splits=config.N_FOLDS, shuffle=True, random_state=42)

fold_predictions = []
oof_predictions = np.zeros((len(train_df), config.NUM_LABELS))

for fold, (train_idx, val_idx) in enumerate(skf.split(train_df, y_dominant)):
    print(f"\n{'='*70}", flush=True)
    print(f"FOLD {fold + 1}/{config.N_FOLDS}", flush=True)
    print(f"{'='*70}", flush=True)
    
    # Prepare data
    train_texts = train_df.iloc[train_idx]['text'].values
    train_labels = y_train[train_idx]
    val_texts = train_df.iloc[val_idx]['text'].values
    val_labels = y_train[val_idx]
    
    print(f"Train: {len(train_texts)} samples | Val: {len(val_texts)} samples", flush=True)
    
    train_dataset = MultiLabelTextDataset(train_texts, train_labels, tokenizer, config.MAX_LENGTH)
    val_dataset = MultiLabelTextDataset(val_texts, val_labels, tokenizer, config.MAX_LENGTH)
    
    # FIXED: num_workers=0 to prevent hanging in Docker/RunPod
    train_loader = DataLoader(train_dataset, batch_size=config.BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=config.BATCH_SIZE * 2, shuffle=False, num_workers=0)
    
    # Initialize model
    print(f"Loading {config.MODEL_NAME}...", flush=True)
    model = MultiLabelClassifier(config.MODEL_NAME, config.NUM_LABELS)
    model = model.to(config.DEVICE)
    print("✓ Model loaded to GPU", flush=True)
    
    # Weighted BCE Loss
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weights)
    
    # Optimizer and scheduler
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.LEARNING_RATE,
        weight_decay=config.WEIGHT_DECAY
    )
    
    num_training_steps = len(train_loader) * config.EPOCHS // config.GRADIENT_ACCUMULATION
    num_warmup_steps = int(num_training_steps * config.WARMUP_RATIO)
    
    scheduler = get_cosine_schedule_with_warmup(
        optimizer,
        num_warmup_steps=num_warmup_steps,
        num_training_steps=num_training_steps
    )
    
    print(f"Starting training with {len(train_loader)} batches per epoch...", flush=True)
    
    # Training loop
    best_f1 = 0
    best_model_path = config.OUTPUT_DIR / f"best_model_fold{fold}.pt"
    
    for epoch in range(config.EPOCHS):
        print(f"\n--- Epoch {epoch + 1}/{config.EPOCHS} ---", flush=True)
        
        train_loss = train_epoch(
            model, train_loader, optimizer, scheduler, 
            criterion, config.DEVICE, config.GRADIENT_ACCUMULATION
        )
        
        val_loss, val_f1, f1_per_class = validate(
            model, val_loader, criterion, config.DEVICE
        )
        
        print(f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Macro F1: {val_f1:.4f}", flush=True)
        top_3_f1 = sorted(zip(config.LABEL_COLS, f1_per_class), key=lambda x: x[1], reverse=True)[:3]
        print(f"Top 3 class F1: {top_3_f1}", flush=True)
        
        if val_f1 > best_f1:
            best_f1 = val_f1
            torch.save(model.state_dict(), best_model_path)
            print(f"✓ Saved best model (F1: {best_f1:.4f})", flush=True)
    
    # Load best model and get OOF predictions
    print("\nGenerating out-of-fold predictions...", flush=True)
    model.load_state_dict(torch.load(best_model_path))
    model.eval()
    
    with torch.no_grad():
        val_preds = []
        for batch in tqdm(val_loader, desc='OOF Predictions'):
            input_ids = batch['input_ids'].to(config.DEVICE)
            attention_mask = batch['attention_mask'].to(config.DEVICE)
            
            logits = model(input_ids, attention_mask)
            probs = torch.sigmoid(logits)
            val_preds.append(probs.cpu().numpy())
        
        val_preds = np.vstack(val_preds)
        oof_predictions[val_idx] = val_preds
    
    # Get test predictions for this fold
    print("Generating test predictions...", flush=True)
    test_dataset = MultiLabelTextDataset(
        test_df['text'].values,
        np.zeros((len(test_df), config.NUM_LABELS)),
        tokenizer,
        config.MAX_LENGTH
    )
    # FIXED: num_workers=0
    test_loader = DataLoader(test_dataset, batch_size=config.BATCH_SIZE * 2, shuffle=False, num_workers=0)
    
    model.eval()
    with torch.no_grad():
        test_preds = []
        for batch in tqdm(test_loader, desc='Test Predictions'):
            input_ids = batch['input_ids'].to(config.DEVICE)
            attention_mask = batch['attention_mask'].to(config.DEVICE)
            
            logits = model(input_ids, attention_mask)
            probs = torch.sigmoid(logits)
            test_preds.append(probs.cpu().numpy())
        
        test_preds = np.vstack(test_preds)
        fold_predictions.append(test_preds)
    
    print(f"\nFold {fold + 1} Complete - Best Val F1: {best_f1:.4f}", flush=True)
    
    # Clean up
    del model, train_loader, val_loader, test_loader
    torch.cuda.empty_cache()

# ==================== ENSEMBLE & THRESHOLD OPTIMIZATION ====================

print("\n" + "="*70, flush=True)
print("CREATING ENSEMBLE PREDICTIONS", flush=True)
print("="*70, flush=True)

# Average predictions across folds
final_test_preds = np.mean(fold_predictions, axis=0)
print(f"✓ Averaged {len(fold_predictions)} fold predictions", flush=True)

# Find optimal threshold using OOF predictions
print("\nOptimizing threshold on OOF predictions...", flush=True)
best_threshold = 0.5
best_oof_f1 = 0

for threshold in tqdm(np.arange(0.3, 0.7, 0.02), desc='Threshold search'):
    oof_binary = (oof_predictions > threshold).astype(int)
    
    # Ensure at least one label per sample
    for i in range(len(oof_binary)):
        if oof_binary[i].sum() == 0:
            oof_binary[i, np.argmax(oof_predictions[i])] = 1
    
    f1 = f1_score(y_train, oof_binary, average='macro', zero_division=0)
    
    if f1 > best_oof_f1:
        best_oof_f1 = f1
        best_threshold = threshold

print(f"\n✓ Best threshold: {best_threshold:.3f}", flush=True)
print(f"✓ OOF Macro F1: {best_oof_f1:.4f}", flush=True)

# Calculate per-class F1 scores
oof_binary = (oof_predictions > best_threshold).astype(int)
for i in range(len(oof_binary)):
    if oof_binary[i].sum() == 0:
        oof_binary[i, np.argmax(oof_predictions[i])] = 1

print("\nPer-class OOF F1 scores:", flush=True)
for i, label in enumerate(config.LABEL_COLS):
    f1 = f1_score(y_train[:, i], oof_binary[:, i], zero_division=0)
    print(f"  {label:20s}: {f1:.4f}", flush=True)

# Apply best threshold to test predictions
final_binary_preds = (final_test_preds > best_threshold).astype(int)

# Ensure at least one label per sample
for i in range(len(final_binary_preds)):
    if final_binary_preds[i].sum() == 0:
        final_binary_preds[i, np.argmax(final_test_preds[i])] = 1

# ==================== CREATE SUBMISSION ====================

print("\n" + "="*70, flush=True)
print("CREATING SUBMISSION FILE", flush=True)
print("="*70, flush=True)

# Check if test has 'id' or 'ID' column
if 'id' in test_df.columns:
    id_col = 'id'
elif 'ID' in test_df.columns:
    id_col = 'ID'
else:
    id_col = 'id'
    test_df['id'] = range(len(test_df))
    print("⚠ No ID column found, using sequential IDs", flush=True)

submission = pd.DataFrame({
    'id': test_df[id_col]
})

for i, col in enumerate(config.LABEL_COLS):
    submission[col] = final_binary_preds[:, i]

# Verify submission format
print("\nSubmission verification:", flush=True)
print(f"  Shape: {submission.shape}", flush=True)
print(f"  Required shape: ({len(test_df)}, {len(config.LABEL_COLS) + 1})", flush=True)
print(f"  At least one label per row: {(submission[config.LABEL_COLS].sum(axis=1) > 0).all()}", flush=True)

print(f"\nFirst 3 rows:", flush=True)
print(submission.head(3))

print(f"\nLabel distribution in submission:", flush=True)
for col in config.LABEL_COLS:
    count = submission[col].sum()
    pct = count / len(submission) * 100
    print(f"  {col:20s}: {int(count):5d} ({pct:5.1f}%)", flush=True)

# Save submission
submission_path = config.OUTPUT_DIR / "submission.csv"
submission.to_csv(submission_path, index=False)

print(f"\n{'='*70}", flush=True)
print(f"✓ SUBMISSION SAVED: {submission_path}", flush=True)
print(f"{'='*70}", flush=True)
print(f"OOF Macro F1 Score: {best_oof_f1:.4f}", flush=True)
print(f"Optimal Threshold: {best_threshold:.3f}", flush=True)
print(f"Total Training Samples: {len(train_df):,}", flush=True)
print(f"Test Samples: {len(test_df):,}", flush=True)
print(f"{'='*70}", flush=True)
````