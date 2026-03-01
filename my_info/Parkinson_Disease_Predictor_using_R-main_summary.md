# Parkinson's Disease Predictor using R - Technical Summary

## Overview
A machine learning pipeline built in R that predicts Parkinson's disease from biomedical voice measurements. The project implements end-to-end data science workflow—from exploratory data analysis and feature selection (LASSO regularization) through training and evaluating four classification models (Decision Tree, Random Forest, SVM, XGBoost)—on a 195-sample clinical voice dataset with 24 features, achieving up to 81.58% accuracy with the Random Forest and SVM models.

## Project Type
Machine Learning Pipeline | Healthcare Data Science | Binary Classification | Biomedical Signal Analysis

## Tech Stack

### Languages
- **R**: Entire analysis pipeline implemented as an R Markdown notebook producing a self-contained HTML report

### Frameworks & Libraries
- **caret**: Unified training framework for model building, hyperparameter tuning, and 5-fold cross-validation
- **randomForest**: Ensemble classification via bagging of decision trees
- **rpart**: Decision tree construction with complexity parameter tuning (cp grid 0.01–0.50)
- **e1071**: Support Vector Machine with RBF kernel (cost=1000, gamma=0.1)
- **xgboost**: Gradient boosted trees with binary logistic objective (100 rounds)
- **glmnet**: LASSO (L1) regularization for automated feature selection via cross-validated lambda
- **ggplot2**: Publication-quality data visualizations (bar plots, box plots, violin plots, faceted comparisons)
- **corrplot**: Hierarchically-clustered correlation matrix heatmaps with coefficient annotations
- **dplyr / tidyr / tibble**: Data wrangling, reshaping (pivot_longer), and factor manipulation
- **caTools**: Train-test data partitioning
- **Hmisc**: Supplementary statistical utilities

### Data & Storage
- **CSV**: Input dataset (`parkinsons_data.csv`) — 195 observations x 24 features
- **RDS**: Serialized trained model artifacts for Decision Tree, Random Forest, SVM, and XGBoost
- **PNG**: Exported model comparison charts

### Tools & Environment
- **R Markdown (Rmd)**: Literate programming notebook combining code, visualizations, and written analysis into a reproducible HTML report
- **RStudio**: Recommended IDE for knitting the report

## Architecture Highlights
- **End-to-end ML pipeline** in a single R Markdown document covering data ingestion, cleaning, EDA, feature selection, model training, evaluation, and model persistence
- **LASSO-based feature selection** reduces 23 predictors down to 2–3 key voice biomarkers (HNR, RPDE, NHR) before training Random Forest, SVM, and XGBoost, reducing dimensionality and mitigating overfitting
- **Systematic model comparison** across four algorithm families (tree-based, ensemble, kernel-based, boosting) with consistent evaluation metrics and confusion matrix analysis
- **Reproducible research** approach using set.seed() for deterministic splits and R Markdown for fully reproducible report generation
- **Model serialization** via RDS format enables downstream deployment or scoring without retraining

## Key Features Implemented
1. **Data Cleaning & Preprocessing**: Automated NA/NULL detection and removal, factor conversion for binary target variable, column pruning of non-predictive identifiers
2. **Comprehensive EDA Suite**: Correlation matrix with top-15 feature ranking against target, faceted box plots across all 23 features by disease status, focused violin plots and mean-comparison bar charts for key biomarkers (NHR, HNR, RPDE)
3. **LASSO Feature Selection**: Cross-validated L1 regularization (`cv.glmnet`) to identify the most informative voice features, reducing model complexity and improving generalization
4. **Decision Tree Classifier**: Hyperparameter-tuned via 5-fold CV over 50 complexity parameter values (0.01–0.50 grid), achieving 76.32% accuracy with balanced sensitivity/specificity trade-off
5. **Random Forest Classifier**: Ensemble of decision trees with LASSO-selected features and mtry grid search under 5-fold CV, achieving 81.58% accuracy and 93.10% specificity
6. **SVM Classifier (RBF Kernel)**: Radial basis function kernel with tuned cost (1000) and gamma (0.1) parameters on LASSO-selected features, achieving 81.58% accuracy and perfect 100% specificity
7. **XGBoost Classifier**: Gradient boosted tree ensemble with 100 boosting rounds and binary logistic objective on LASSO-selected features, achieving 71.79% accuracy
8. **Model Performance Dashboard**: Side-by-side accuracy comparison bar chart across all four models with percentage annotations, exported as publication-ready PNG
9. **Detailed Confusion Matrix Analysis**: Per-model breakdown of sensitivity, specificity, PPV, NPV, and balanced accuracy with clinical interpretation of trade-offs

## Technical Complexity Indicators
- **Codebase Scale**: Small-medium — 1 R Markdown file (~1,250 lines including code, analysis narrative, and interpretation), 1 dataset file, model output artifacts
- **ML Pipeline Complexity**: 4 distinct classification algorithms compared with consistent evaluation methodology
- **Feature Engineering**: LASSO-based dimensionality reduction from 23 features to 2–3 selected biomarkers
- **Cross-Validation**: 5-fold cross-validation for hyperparameter tuning across all models
- **Domain Complexity**: Biomedical voice signal analysis for healthcare diagnostics — requires understanding of jitter, shimmer, harmonic ratios, and nonlinear dynamics measures
- **Data Characteristics**: Imbalanced binary classification (147 Parkinson's vs 48 healthy — ~75/25 split)
- **Testing**: Model evaluation via train/test split (80/20) with comprehensive confusion matrix metrics
- **CI/CD**: Not applicable (research/analysis project)

## Quantifiable Metrics (Estimated)
- **Dataset**: 195 clinical voice recordings with 24 biomedical features per sample
- **Best Model Accuracy**: 81.58% (Random Forest and SVM tied)
- **Best Specificity**: 100% (SVM — perfect identification of Parkinson's-positive cases)
- **Best Sensitivity**: 55.56% (Decision Tree — best at identifying healthy individuals)
- **Feature Reduction**: 23 → 2–3 features via LASSO, ~87–91% dimensionality reduction
- **Hyperparameter Search Space**: 50 cp values for Decision Tree, mtry grid for Random Forest
- **Models Trained & Serialized**: 4 trained models saved as RDS artifacts
- **Visualizations Generated**: 6+ distinct plot types (bar, box, violin, correlation heatmap, faceted comparisons, model comparison chart)

## Resume-Ready Bullet Points
> These are draft bullet points optimized for ATS and impact. Use as starting points.

- Developed a Parkinson's disease prediction pipeline in R using Random Forest, SVM, Decision Tree, and XGBoost classifiers on 195 biomedical voice recordings, achieving 81.58% classification accuracy
- Implemented LASSO (L1 regularization) feature selection using glmnet to reduce 23 voice biomarkers to 3 key predictors (NHR, HNR, RPDE), cutting dimensionality by ~87% while preserving predictive power
- Engineered a comprehensive EDA workflow with ggplot2 and corrplot, producing correlation heatmaps, faceted box plots, violin plots, and bar charts to identify statistically significant voice features associated with Parkinson's disease
- Built and compared 4 classification models with 5-fold cross-validated hyperparameter tuning using the caret framework, evaluating accuracy, sensitivity, specificity, PPV, NPV, and balanced accuracy
- Trained an SVM classifier with RBF kernel achieving 100% specificity (zero false positives) on the Parkinson's disease detection task, demonstrating strong clinical screening potential
- Created a reproducible R Markdown analysis notebook combining literate programming with automated report generation, including serialized model artifacts (RDS) for downstream deployment

## Keywords for ATS
R, R Markdown, Machine Learning, Classification, Binary Classification, Random Forest, Decision Tree, Support Vector Machine (SVM), XGBoost, Gradient Boosting, LASSO, L1 Regularization, Feature Selection, Cross-Validation, Hyperparameter Tuning, caret, glmnet, e1071, rpart, randomForest, xgboost, ggplot2, corrplot, dplyr, tidyr, tibble, caTools, Hmisc, Confusion Matrix, Sensitivity, Specificity, Accuracy, EDA, Exploratory Data Analysis, Data Visualization, Correlation Analysis, Box Plot, Violin Plot, Healthcare Analytics, Biomedical Data, Voice Analysis, Signal Processing, Parkinson's Disease, Clinical Data Science, Reproducible Research, Predictive Modeling, Dimensionality Reduction, Data Preprocessing, Model Evaluation, Model Serialization, RDS, HTML Report

## Notes for Resume Tailoring
- **Best suited for roles involving**: Data Science, Machine Learning Engineering, Healthcare/Biomedical Analytics, Statistical Modeling, Clinical Research Data Analysis, Bioinformatics
- **Strongest demonstration of**: End-to-end ML pipeline development in R, systematic model comparison methodology, feature selection and dimensionality reduction for clinical data
- **Potential talking points for interviews**:
  - Why LASSO was chosen over other feature selection methods (embedded method, handles multicollinearity in voice features)
  - Trade-off analysis between sensitivity and specificity in a medical diagnostic context (SVM had perfect specificity but poor sensitivity — clinical implications of false negatives vs. false positives)
  - Class imbalance handling — the 75/25 split and how techniques like SMOTE could improve minority class detection
  - Why Random Forest outperformed XGBoost on this small dataset (boosting methods can overfit with limited samples)
  - Reproducibility practices: seed setting, R Markdown for literate programming, model serialization for deployment readiness
