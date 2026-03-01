# Note Flow - Technical Summary

## Overview
Note Flow is an end-to-end AI-powered music composition system that generates original musical pieces in ABC notation using a character-level LSTM neural network trained on a corpus of 8,886 Irish folk tunes. The system implements a complete pipeline from raw text data preprocessing through model training, music generation with temperature-controlled sampling, and real-time audio playback via ABC-to-MIDI-to-WAV conversion.

## Project Type
Deep Learning / Music Generation / Generative AI

## Tech Stack

### Languages
- **Python**: Core implementation language for all model development, data processing, training, and inference

### Frameworks & Libraries
- **PyTorch**: Deep learning framework used for LSTM model definition, training loop, GPU-accelerated computation, and model serialization
- **PyTorch nn.Module**: Custom neural network architecture (LSTMModel) with embedding, LSTM, and linear layers
- **NumPy**: Numerical computing for data vectorization, batch generation, and array operations
- **SciPy (scipy.io.wavfile)**: Audio file I/O for WAV format writing and processing
- **tqdm**: Training progress visualization across 10,000 iterations
- **regex**: Advanced pattern matching for extracting individual songs from the ABC notation corpus
- **IPython Display**: In-notebook audio playback and interactive output rendering
- **Jupyter Notebook**: Development environment and reproducible experimentation platform

### Data & Audio Processing
- **abcmidi**: System-level tool for converting ABC notation text files to MIDI format
- **timidity**: MIDI synthesizer for rendering MIDI files to WAV audio

### Cloud & DevOps
- **Google Colab**: Cloud-based training environment with GPU acceleration (CUDA)
- **HuggingFace Hub**: Dataset sourcing (IrishMAN dataset) and model deployment readiness

### APIs & Integrations
- **HuggingFace Datasets**: Source for the Irish Massive ABC Notation (IrishMAN) training corpus (216,284 tunes)
- **Google Magenta (Onsets & Frames)**: Explored for MP3-to-MIDI audio transcription during development

## Architecture Highlights
- **Character-level LSTM sequence model** with 23.2 million trainable parameters: Embedding layer (86×256) → Single-layer LSTM (2,048 hidden units) → Linear projection (2,048→86 vocabulary)
- **Temperature-controlled autoregressive generation**: Implements softmax sampling with configurable temperature parameter (0.5–1.2) to balance musical coherence against creative diversity
- **Multi-stage audio conversion pipeline**: Text generation → ABC file serialization → MIDI conversion (abc2midi) → WAV synthesis (timidity) → IPython audio playback — bridging symbolic music representation to audible output
- **Efficient batch training strategy**: Random sampling of overlapping sequences (length 250) from the concatenated corpus, enabling diverse training examples from a fixed dataset without explicit epoch boundaries

## Key Features Implemented
1. **Custom LSTM Neural Network**: Built a PyTorch nn.Module with character embedding, single-layer LSTM (2,048 hidden units), and vocabulary projection — totaling ~23.2M parameters optimized via Adam with cross-entropy loss
2. **ABC Notation Data Pipeline**: Engineered preprocessing to parse 8,886 songs from raw text, build a character-to-index vocabulary (86 unique tokens), and generate randomized training batches with configurable sequence length
3. **Temperature-Controlled Music Generation**: Implemented autoregressive text generation with softmax temperature scaling, enabling users to control the trade-off between musical coherence (low temperature) and creative variation (high temperature)
4. **End-to-End Audio Playback Pipeline**: Built a seamless conversion chain from generated ABC notation text → .abc file → MIDI (abcmidi) → WAV (timidity) → in-notebook audio playback, enabling real-time listening of AI-composed music
5. **Model Checkpointing & Persistence**: Implemented periodic model saving every 100 training iterations with PyTorch state dictionary serialization, producing a deployable 73 MB trained model
6. **MP3-to-ABC Exploration (Magenta Integration)**: Investigated audio-to-MIDI transcription using Google Magenta's Onsets & Frames model, identifying limitations in MIDI-to-ABC conversion for polyphonic content

## Technical Complexity Indicators
- **Codebase Scale**: Small-medium — single Jupyter notebook (~20 code cells) containing complete end-to-end pipeline; 6 total project files
- **Model Complexity**: 23.2 million parameters; LSTM hidden size of 2,048; 256-dimensional character embeddings; 86-character vocabulary
- **Data Complexity**: 8,886 ABC notation songs (~1.1 MB text corpus), 86 unique character tokens, sequence-level batching with length 250
- **Training Scale**: 10,000 iterations, batch size 16, learning rate 5e-3 with Adam optimizer, loss tracking and periodic checkpointing
- **Integration Complexity**: 3 external tools integrated (abcmidi, timidity, HuggingFace datasets); explored Magenta for audio transcription
- **Testing**: No dedicated test suite; validation performed through generated output quality assessment and audio playback
- **CI/CD**: None — project designed for interactive Colab/notebook execution

## Quantifiable Metrics (Estimated)
- **Model Parameters**: ~23.2 million trainable parameters (Embedding: ~22K + LSTM: ~23M + Linear: ~176K)
- **Training Data**: 8,886 songs processed from 1.1 MB ABC notation corpus (sourced from 216,284-tune HuggingFace dataset)
- **Vocabulary Size**: 86 unique characters mapped to embedding vectors
- **Training Iterations**: 10,000 with checkpointing every 100 iterations (100 checkpoint saves)
- **Generation Capacity**: Produces 300–1,000 character musical compositions per inference pass
- **Model Artifact Size**: 73 MB serialized PyTorch state dictionary
- **Audio Pipeline Stages**: 4-stage conversion (Text → ABC → MIDI → WAV)

## Resume-Ready Bullet Points
> These are draft bullet points optimized for ATS and impact. Use as starting points.

- Developed an AI music composition system using PyTorch LSTM (23.2M parameters) trained on 8,886 Irish folk tunes in ABC notation, generating original musical compositions with temperature-controlled autoregressive sampling
- Engineered a complete data preprocessing pipeline to parse, tokenize, and vectorize a 1.1 MB ABC notation corpus into a character-level vocabulary of 86 tokens with randomized sequence batching for efficient model training
- Built a 4-stage audio conversion pipeline (ABC notation → MIDI → WAV → playback) integrating system-level tools (abcmidi, timidity) with Python, enabling real-time listening of AI-generated music within Jupyter notebooks
- Designed and trained a character-level LSTM neural network with 2,048 hidden units and 256-dimensional embeddings using PyTorch, achieving coherent music generation after 10,000 training iterations with Adam optimization
- Implemented configurable music generation with temperature-based softmax sampling, allowing users to control creativity-coherence trade-offs in generated compositions ranging from 300 to 1,000 characters
- Explored MP3-to-MIDI transcription using Google Magenta's Onsets & Frames model, identifying technical limitations in polyphonic audio-to-symbolic music conversion for ABC notation

## Keywords for ATS
Python, PyTorch, LSTM, RNN, Deep Learning, Neural Networks, Generative AI, Music Generation, Natural Language Processing, NLP, Sequence Modeling, Character-Level Model, Autoregressive Generation, ABC Notation, MIDI, Audio Processing, NumPy, SciPy, Jupyter Notebook, Google Colab, HuggingFace, GPU Computing, CUDA, Model Training, Hyperparameter Tuning, Cross-Entropy Loss, Adam Optimizer, Softmax Sampling, Temperature Scaling, Embeddings, Data Preprocessing, Tokenization, Vectorization, Model Serialization, Checkpoint Management, Signal Processing, Google Magenta, Machine Learning, Artificial Intelligence

## Notes for Resume Tailoring
- **Best suited for roles involving**: Machine Learning Engineering, Deep Learning, Generative AI, NLP/Sequence Modeling, Audio/Music Technology, Applied AI Research
- **Strongest demonstration of**: PyTorch model development from scratch (architecture design, training loop, inference pipeline), end-to-end ML system building (data → training → generation → output), creative AI application development
- **Potential talking points for interviews**:
  - Design decisions around single-layer LSTM vs. deeper architectures and how hidden size (2,048) compensates for depth
  - Temperature sampling mechanics and its effect on generated music quality/diversity
  - Challenges encountered with MIDI-to-ABC conversion and why symbolic music representation matters for generative models
  - Trade-offs in character-level vs. token-level modeling for structured text like ABC notation
  - How the training batch strategy (random sequence sampling) differs from traditional epoch-based training and its impact on convergence
