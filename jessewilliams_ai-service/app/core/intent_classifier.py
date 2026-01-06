"""Enhanced Intent Classification with Greeting Detection"""

import re
from typing import Dict, List, Tuple

class IntentClassifier:
    """Classifies user queries with proper greeting handling"""
    
    # Greeting patterns
    GREETINGS = [
        'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon',
        'good evening', 'howdy', 'hola', 'bonjour', 'sup', 'yo', 'whats up',
        "what's up", 'how are you', 'hows it going', "how's it going"
    ]
    
    # Intent patterns
    INTENTS = {
        'deal_hunter': {
            'keywords': [
                'find', 'search', 'locate', 'properties', 'deals', 'opportunities',
                'market', 'neighborhood', 'strategy', 'plan', 'invest', 'build',
                'flip', 'rental', 'buy', 'acquire', 'portfolio', 'land', 'commercial',
                'residential', 'starting', 'capital', 'target', 'county', 'city'
            ],
            'patterns': [
                r'find.*propert(y|ies)',
                r'search.*(deal|land|home|propert)',
                r'build.*(plan|strategy)',
                r'start(ing)?\s*\$?\d+',
                r'(travis|orange|miami|austin|county)',
                r'low.capital',
                r'create.*strategy',
                r'compare.*plan',
                r'(land|residential|commercial)\s*(real\s*estate)?'
            ]
        },
        
        'underwriting_analyzer': {
            'keywords': [
                'analyze', 'analysis', 'calculate', 'roi', 'cash flow', 'return',
                'profit', 'cap rate', 'noi', 'expenses', 'income', 'financial',
                'worth', 'value', 'underwrite', 'numbers', 'crunch', 'arv'
            ],
            'patterns': [
                r'analyz(e|ing)',
                r'calculat(e|ing)',
                r'cash\s*flow',
                r'roi|return\s*on\s*investment',
                r'what.*profit',
                r'how\s*much.*make',
                r'worth.*invest',
                r'financial.*analysis',
                r'cap\s*rate',
                r'underwrite'
            ]
        },
        
        'offer_outreach': {
            'keywords': [
                'write', 'draft', 'create', 'generate', 'letter', 'offer',
                'loi', 'proposal', 'email', 'script', 'document', 'template',
                'excel', 'word', 'powerpoint', 'spreadsheet', 'presentation',
                'download', 'export', 'file'
            ],
            'patterns': [
                r'write.*(letter|offer|loi)',
                r'draft.*(offer|proposal)',
                r'create.*(document|file|excel|word)',
                r'generate.*(spreadsheet|presentation)',
                r'(excel|word|powerpoint|pptx|xlsx|docx)',
                r'(download|export).*file',
                r'make.*(excel|spreadsheet|document)'
            ]
        }
    }
    
    def is_greeting(self, message: str) -> bool:
        """Check if message is just a greeting"""
        message_clean = message.lower().strip().rstrip('!.?')
        
        # Exact match greetings
        if message_clean in self.GREETINGS:
            return True
        
        # Check if message is ONLY greetings (no other words)
        words = message_clean.split()
        if len(words) <= 3:  # Short messages
            for greeting in self.GREETINGS:
                if greeting in message_clean:
                    return True
        
        return False
    
    def classify(self, message: str) -> Tuple[str, float, Dict]:
        """
        Classify user message into intent
        
        Returns:
            (intent_name, confidence_score, metadata)
        """
        
        # Check for greeting first
        if self.is_greeting(message):
            return 'greeting', 1.0, {'reason': 'greeting_detected'}
        
        message_lower = message.lower()
        scores = {}
        
        # Score each intent
        for intent, config in self.INTENTS.items():
            score = 0
            matched_keywords = []
            matched_patterns = []
            
            # Check keywords
            for keyword in config['keywords']:
                if keyword in message_lower:
                    score += 1
                    matched_keywords.append(keyword)
            
            # Check patterns (higher weight)
            for pattern in config['patterns']:
                if re.search(pattern, message_lower, re.IGNORECASE):
                    score += 3
                    matched_patterns.append(pattern)
            
            scores[intent] = {
                'score': score,
                'keywords': matched_keywords,
                'patterns': matched_patterns
            }
        
        # Determine winner
        if all(s['score'] == 0 for s in scores.values()):
            # No clear intent - default to deal_hunter
            return 'deal_hunter', 0.5, {'reason': 'default'}
        
        winner = max(scores.items(), key=lambda x: x[1]['score'])
        intent_name = winner[0]
        max_score = winner[1]['score']
        
        # Calculate confidence (0-1)
        total_score = sum(s['score'] for s in scores.values())
        confidence = max_score / total_score if total_score > 0 else 0.5
        
        metadata = {
            'matched_keywords': winner[1]['keywords'][:5],
            'matched_patterns': winner[1]['patterns'][:3],
            'all_scores': {k: v['score'] for k, v in scores.items()}
        }
        
        return intent_name, confidence, metadata