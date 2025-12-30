class ResponseFormatter:
    """Ensures consistent, professional formatting of Deal Hunter responses"""
    
    @staticmethod
    def format_capital_amount(amount: float) -> str:
        """Format dollar amounts consistently"""
        if amount >= 1000000:
            return f"${amount/1000000:.1f}M"
        elif amount >= 1000:
            return f"${amount/1000:.0f}K"
        else:
            return f"${amount:,.0f}"
    
    @staticmethod
    def create_table(headers: list, rows: list) -> str:
        """Create markdown table"""
        header_row = "| " + " | ".join(headers) + " |"
        separator = "|" + "|".join(["---" for _ in headers]) + "|"
        data_rows = "\n".join(["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows])
        return f"{header_row}\n{separator}\n{data_rows}"
    
    @staticmethod
    def add_section_emoji(section_name: str) -> str:
        """Add appropriate emoji to section headers"""
        emoji_map = {
            'target': '🎯',
            'outcome': '🎯',
            'financial': '📊',
            'analysis': '📊',
            'profit': '💰',
            'property': '🏘️',
            'asset': '🏘️',
            'market': '🏘️',
            'risk': '⚠️',
            'action': '📋',
            'steps': '📋',
            'next': '📋',
            'strategy': '⭐',
            'ranking': '⭐',
            'execution': '🏗️',
            'plan': '🏗️'
        }
        
        section_lower = section_name.lower()
        for keyword, emoji in emoji_map.items():
            if keyword in section_lower:
                return f"{emoji} **{section_name}**"
        
        return f"**{section_name}**"
    
    @staticmethod
    def format_opening_acknowledgment(query_type: str, location: str, capital: str = None) -> str:
        """Create professional opening statement"""
        if capital:
            return f"Understood. Below is a low-capital {query_type} strategy for {location}."
        else:
            return f"Understood. Here's how current {location} market conditions translate into executable {query_type} opportunities."
    
    @staticmethod
    def format_numbered_steps(steps: list, title: str = "Next Steps") -> str:
        """Format action steps consistently"""
        formatted = f"\n**{title}**\n\n"
        for i, step in enumerate(steps, 1):
            formatted += f"{i}. {step}\n"
        return formatted
    
    @staticmethod
    def ensure_proper_spacing(text: str) -> str:
        """Clean up spacing in generated text"""
        # Remove excessive blank lines (more than 2 consecutive)
        import re
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Ensure single space after periods
        text = re.sub(r'\.  +', '. ', text)
        
        # Ensure proper spacing around headers
        text = re.sub(r'\n(#{1,6} )', r'\n\n\1', text)
        
        return text.strip()