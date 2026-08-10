"""
lemmatize.py — Lemmatization for campaign converter
=====================================================
Extracts surface→lemma mappings from text for each supported language.

Dependencies (install once):
    pip install spacy fugashi unidic-lite jieba

spaCy models (install once):
    python -m spacy download de_core_news_sm
    python -m spacy download fr_core_news_sm
    python -m spacy download es_core_news_sm
    python -m spacy download ja_core_news_sm
    python -m spacy download zh_core_web_sm

Usage:
    from lemmatize import lemmatize_text, lemmatize_supported

    # Single text
    pairs = lemmatize_text("Er isst einen Apfel", "de", vocab_entries={"essen", "Apfel"})
    # → {"isst": "essen", "einen": "ein"}  (only forms that differ from lemma)

    # Full section (all languages)
    all_pairs = lemmatize_supported(texts_by_lang, vocab_sets_by_lang)
"""

import re
import unicodedata
from typing import Dict, Set, Optional

# ── Language → spaCy model name ───────────────────────────────────────────────

SPACY_MODELS = {
    'de': 'de_core_news_sm',
    'fr': 'fr_core_news_sm',
    'es': 'es_core_news_sm',
    'ja': 'ja_core_news_sm',
    'zh': 'zh_core_web_sm',
}

# Cache loaded models
_nlp_cache: Dict[str, object] = {}


def get_nlp(lang: str):
    """Load and cache a spaCy model for the given language."""
    if lang in _nlp_cache:
        return _nlp_cache[lang]
    model = SPACY_MODELS.get(lang)
    if not model:
        return None
    try:
        import spacy
        nlp = spacy.load(model)
        _nlp_cache[lang] = nlp
        print(f"  ✓ Loaded {model}")
        return nlp
    except OSError:
        print(f"  ⚠ Model '{model}' not installed. Run: python -m spacy download {model}")
        _nlp_cache[lang] = None
        return None


# ── Japanese via fugashi ───────────────────────────────────────────────────────

_tagger = None


def get_tagger():
    global _tagger
    if _tagger is not None:
        return _tagger
    try:
        import fugashi
        _tagger = fugashi.Tagger()
        print("  ✓ Loaded fugashi tagger")
        return _tagger
    except Exception as e:
        print(f"  ⚠ fugashi not available: {e}")
        return None


def lemmatize_japanese(text: str, vocab_entries: Optional[Set[str]] = None) -> Dict[str, str]:
    """Extract surface→lemma pairs from Japanese text using fugashi."""
    tagger = get_tagger()
    if not tagger:
        return {}
    pairs = {}
    try:
        for word in tagger(text):
            surface = word.surface
            # unidic-lite feature format: pos1,pos2,...,lemma,...
            # lemma is at feature index 7 for full unidic, 10 for unidic-lite
            feature = word.feature_raw.split(',') if hasattr(word, 'feature_raw') else []
            lemma = None
            # Try to extract lemma from feature
            for i in [7, 10, 4]:
                if i < len(feature) and feature[i] and feature[i] != '*':
                    lemma = feature[i]
                    break
            if not lemma:
                lemma = surface
            # Normalise
            lemma = unicodedata.normalize('NFC', lemma)
            surface_norm = unicodedata.normalize('NFC', surface)
            if surface_norm != lemma:
                # If vocab_entries provided, only include if lemma is in vocab
                if vocab_entries is None or lemma in vocab_entries:
                    pairs[surface_norm] = lemma
    except Exception as e:
        print(f"  ⚠ Japanese lemmatization error: {e}")
    return pairs


# ── Chinese via jieba ──────────────────────────────────────────────────────────

def lemmatize_chinese(text: str, vocab_entries: Optional[Set[str]] = None) -> Dict[str, str]:
    """
    Chinese doesn't inflect, so lemmatization is really just word segmentation.
    Returns each word as surface=lemma (identical) so the app knows word boundaries.
    Only returns words found in vocab_entries if provided.
    """
    try:
        import jieba
        words = list(jieba.cut(text, cut_all=False))
        pairs = {}
        for w in words:
            w = w.strip()
            if not w or len(w) < 2:
                continue
            if vocab_entries is None or w in vocab_entries:
                pairs[w] = w  # surface == lemma for Chinese
        return pairs
    except Exception as e:
        print(f"  ⚠ Chinese segmentation error: {e}")
        return {}


# ── spaCy-based lemmatization (de, fr, es) ────────────────────────────────────

def lemmatize_spacy(text: str, lang: str, vocab_entries: Optional[Set[str]] = None) -> Dict[str, str]:
    """Extract surface→lemma pairs using spaCy for de/fr/es."""
    nlp = get_nlp(lang)
    if not nlp:
        return {}
    try:
        doc = nlp(text)
        pairs = {}
        for token in doc:
            surface = token.text.strip()
            lemma = token.lemma_.strip()
            if not surface or not lemma or lemma == '--':
                continue
            # Normalise case for comparison: German nouns keep capitalisation
            if lang == 'de':
                # Keep capitalisation as-is (German nouns are capitalised)
                pass
            else:
                surface = surface.lower()
                lemma = lemma.lower()
            if surface != lemma:
                if vocab_entries is None or lemma in vocab_entries or lemma.lower() in vocab_entries:
                    pairs[surface] = lemma
        return pairs
    except Exception as e:
        print(f"  ⚠ spaCy lemmatization error ({lang}): {e}")
        return {}


# ── Main entry point ──────────────────────────────────────────────────────────

def lemmatize_text(text: str, lang: str, vocab_entries: Optional[Set[str]] = None) -> Dict[str, str]:
    """
    Lemmatize a text string for the given language.
    Returns {surface_form: lemma} for forms that differ from their lemma.
    If vocab_entries is provided, only returns pairs where the lemma is in the vocab.
    """
    if not text or not text.strip():
        return {}

    if lang == 'ja':
        return lemmatize_japanese(text, vocab_entries)
    elif lang == 'zh':
        return lemmatize_chinese(text, vocab_entries)
    elif lang in ('de', 'fr', 'es'):
        return lemmatize_spacy(text, lang, vocab_entries)
    else:
        return {}  # English, etc. — no lemmatization needed for now


def lemmatize_section(texts_by_lang: Dict[str, str],
                      vocab_sets_by_lang: Optional[Dict[str, Set[str]]] = None) -> Dict[str, Dict[str, str]]:
    """
    Lemmatize texts for multiple languages at once.

    Args:
        texts_by_lang: {lang: combined_text} e.g. {'de': 'Er isst...', 'ja': '食べます...'}
        vocab_sets_by_lang: optional {lang: {lemma, ...}} to filter output

    Returns:
        {lang: {surface: lemma}} for all languages with non-empty results
    """
    result = {}
    for lang, text in texts_by_lang.items():
        vocab = vocab_sets_by_lang.get(lang) if vocab_sets_by_lang else None
        pairs = lemmatize_text(text, lang, vocab)
        if pairs:
            result[lang] = pairs
    return result


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys
    lang = sys.argv[1] if len(sys.argv) > 1 else 'de'
    text = sys.argv[2] if len(sys.argv) > 2 else 'Er isst einen großen Apfel und trinkt Wasser.'
    print(f"\nLemmatizing [{lang}]: {text}")
    result = lemmatize_text(text, lang)
    if result:
        for surface, lemma in sorted(result.items()):
            print(f"  {surface} → {lemma}")
    else:
        print("  (no results — model may not be installed)")
