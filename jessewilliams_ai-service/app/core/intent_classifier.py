"""
Intent Classification System for Real Estate Investment Assistant
"""

import re
from typing import Dict, List, Tuple

class IntentClassifier:
    """Classifies user queries into one of three agent types"""
    
    # Intent patterns and keywords
    INTENTS = {
        'deal_hunter': {
            'keywords': [
                'find', 'search', 'locate', 'properties', 'deals', 'opportunities',
                'market', 'neighborhood', 'area', 'strategy', 'plan', 'invest',
                'flip', 'rental', 'buy', 'acquire', 'portfolio', 'target',
                'where', 'what areas', 'which neighborhoods', 'best deals',
                'good investment', 'profitable', 'undervalued'
            ],
            'patterns': [
                r'find.*propert(y|ies)',
                r'search.*deal',
                r'looking for.*investment',
                r'where (should|can) i (invest|buy)',
                r'what (areas?|neighborhoods?|markets?)',
                r'build.*plan',
                r'create.*strategy',
                r'\$\d+.*capital',
                r'start(ing)? with \$'
            ]
        },
        
        'underwriting_analyzer': {
            'keywords': [
                'analyze', 'analysis', 'calculate', 'roi', 'cash flow', 'return',
                'numbers', 'profit', 'cap rate', 'noi', 'expenses', 'income',
                'revenue', 'costs', 'budget', 'financial', 'pro forma',
                'worth', 'value', 'appraisal', 'assumptions', 'projections',
                'break even', 'irr', 'dscr', 'ltv', 'arv'
            ],
            'patterns': [
                r'analyz(e|ing)',
                r'calculat(e|ing)',
                r'cash flow',
                r'roi|return on investment',
                r'what.*profit',
                r'how much.*make',
                r'worth.*invest(ing|ment)',
                r'financial.*analysis',
                r'break.*even',
                r'\$\d+.*arv',
                r'cap rate',
                r'net operating income'
            ]
        },
        
        'offer_outreach': {
            'keywords': [
                'write', 'draft', 'create', 'generate', 'letter', 'offer',
                'loi', 'proposal', 'message', 'email', 'script', 'pitch',
                'negotiate', 'deal structure', 'terms', 'contract', 'agreement',
                'communicate', 'reach out', 'contact', 'present', 'seller',
                'buyer', 'template', 'format'
            ],
            'patterns': [
                r'write.*letter',
                r'draft.*offer',
                r'create.*loi',
                r'generate.*script',
                r'help.*write',
                r'how (should|do) i (write|draft|present)',
                r'seller.*message',
                r'outreach.*script',
                r'negotiat(e|ion).*terms',
                r'structure.*deal',
                r'present.*offer'
            ]
        }
    }
    
    def classify(self, message: str) -> Tuple[str, float, Dict]:
        """
        Classify user message into intent
        
        Returns:
            (intent_name, confidence_score, metadata)
        """
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
                if re.search(pattern, message_lower):
                    score += 3
                    matched_patterns.append(pattern)
            
            scores[intent] = {
                'score': score,
                'keywords': matched_keywords,
                'patterns': matched_patterns
            }
        
        # Determine winner
        if all(s['score'] == 0 for s in scores.values()):
            # Default to deal_hunter if no matches
            return 'deal_hunter', 0.5, {'reason': 'default'}
        
        winner = max(scores.items(), key=lambda x: x[1]['score'])
        intent_name = winner[0]
        max_score = winner[1]['score']
        
        # Calculate confidence (0-1)
        total_score = sum(s['score'] for s in scores.values())
        confidence = max_score / total_score if total_score > 0 else 0.5
        
        metadata = {
            'matched_keywords': winner[1]['keywords'],
            'matched_patterns': winner[1]['patterns'],
            'all_scores': {k: v['score'] for k, v in scores.items()}
        }
        
        return intent_name, confidence, metadata
    
    def get_agent_greeting(self, intent: str) -> str:
        """Get appropriate greeting for each agent"""
        greetings = {
            'deal_hunter': [
                'Understood!',
                'Got it!',
                'Perfect!',
                'Excellent!',
                'Acknowledged!'
            ],
            'underwriting_analyzer': [
                'Analyzing now!',
                'Let me crunch those numbers!',
                'Running the analysis!',
                'Calculating!',
                'On it!'
            ],
            'offer_outreach': [
                'Drafting now!',
                'Creating that for you!',
                'Writing it up!',
                'Generating!',
                'On it!'
            ]
        }
        
        import random
        return random.choice(greetings.get(intent, ['Understood!']))


# Example usage
if __name__ == '__main__':
    classifier = IntentClassifier()
    
    test_queries = [
        "Find me fix-and-flip properties under $200k in Austin",
        "Calculate the ROI on a $300k rental property",
        "Write a letter of intent for a commercial property",
        "What neighborhoods should I target for flips?",
        "Analyze the cash flow on this deal",
        "Help me draft an offer letter"
    ]
    
    for query in test_queries:
        intent, confidence, meta = classifier.classify(query)
        print(f"\nQuery: {query}")
        print(f"Intent: {intent} (confidence: {confidence:.2f})")
        print(f"Matched: {meta['matched_keywords'][:3]}")