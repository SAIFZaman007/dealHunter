"""
Response Formatting with Tables & Professional Structure
"""

import random
from typing import List, Dict, Any

class ResponseFormatter:
    """Enterprise-grade response formatting"""
    
    # Varied greeting options
    GREETINGS = [
        "Understood!",
        "Got it!",
        "Perfect!",
        "Acknowledged!",
        "Excellent!",
        "Confirmed!",
        "On it!",
        "Let's dive in!"
    ]
    
    @staticmethod
    def get_greeting() -> str:
        """Get random greeting to avoid repetition"""
        return random.choice(ResponseFormatter.GREETINGS)
    
    @staticmethod
    def format_currency(amount: float, short: bool = False) -> str:
        """Format dollar amounts consistently"""
        if short:
            if amount >= 1000000:
                return f"${amount/1000000:.1f}M"
            elif amount >= 1000:
                return f"${amount/1000:.0f}K"
        return f"${amount:,.0f}"
    
    @staticmethod
    def format_percentage(value: float, decimals: int = 1) -> str:
        """Format percentages"""
        return f"{value:.{decimals}f}%"
    
    @staticmethod
    def create_markdown_table(headers: List[str], rows: List[List[Any]]) -> str:
        """Create properly formatted markdown table"""
        # Header row
        header_row = "| " + " | ".join(str(h) for h in headers) + " |"
        
        # Separator
        separator = "|" + "|".join(["---" for _ in headers]) + "|"
        
        # Data rows
        data_rows = []
        for row in rows:
            row_str = "| " + " | ".join(str(cell) for cell in row) + " |"
            data_rows.append(row_str)
        
        return f"{header_row}\n{separator}\n" + "\n".join(data_rows)
    
    @staticmethod
    def create_capital_profile(
        capital: float,
        strategy_type: str,
        deployments: List[Dict[str, Any]]
    ) -> str:
        """Format capital profile section"""
        output = f"""💼 **Capital Profile**

Capital Available: {ResponseFormatter.format_currency(capital)}
Strategy Type: {strategy_type}
Cash Available: {ResponseFormatter.format_currency(capital * 0.95)}

**Cash Deployment:**"""
        
        for deployment in deployments:
            output += f"\n- {deployment['category']}: {ResponseFormatter.format_currency(deployment['amount'])} ({deployment['purpose']})"
        
        return output
    
    @staticmethod
    def create_outcome_table(
        deals_range: tuple,
        profit_per_deal_range: tuple,
        total_profit_range: tuple,
        roi_range: tuple,
        risk_desc: str
    ) -> str:
        """Create target outcome table"""
        headers = ["Metric", "Projection"]
        rows = [
            ["Deals Closed", f"{deals_range[0]}—{deals_range[1]}"],
            ["Avg Profit / Unit", f"{ResponseFormatter.format_currency(profit_per_deal_range[0])}—{ResponseFormatter.format_currency(profit_per_deal_range[1])}"],
            ["Total Profit Goal", f"{ResponseFormatter.format_currency(total_profit_range[0])}—{ResponseFormatter.format_currency(total_profit_range[1])}"],
            ["Cash-on-Cash ROI", f"{roi_range[0]}%—{roi_range[1]}%"],
            ["Capital at Risk", risk_desc]
        ]
        
        return "🎯 **Target Outcome (6 Months)**\n\n" + ResponseFormatter.create_markdown_table(headers, rows)
    
    @staticmethod
    def create_asset_mix_table(assets: List[Dict[str, Any]], location: str, reasons: List[str]) -> str:
        """Create asset mix table with location reasoning"""
        headers = ["Asset Type", "% of Focus", "Risk"]
        rows = [[a['type'], f"{a['percentage']}%", a['risk']] for a in assets]
        
        table = ResponseFormatter.create_markdown_table(headers, rows)
        
        reasons_text = "\n".join([f"- {reason}" for reason in reasons])
        
        return f"""🏘️ **Recommended Asset Mix**

{table}

**Why {location}:**
{reasons_text}"""
    
    @staticmethod
    def create_profit_projection_table(projections: List[Dict[str, Any]]) -> str:
        """Create cumulative profit projection"""
        headers = ["Month", "Deals", "Cumulative Profit"]
        rows = [
            [p['month'], p['deals'], ResponseFormatter.format_currency(p['profit'])]
            for p in projections
        ]
        
        return "💰 **Cumulative Profit Projection**\n\n" + ResponseFormatter.create_markdown_table(headers, rows)
    
    @staticmethod
    def format_next_steps(steps: List[str], closing_offer: str = None) -> str:
        """Format numbered next steps with optional closing"""
        output = "📋 **Next Steps**\n\n"
        
        for i, step in enumerate(steps, 1):
            output += f"{i}. {step}\n"
        
        if closing_offer:
            output += f"\n{closing_offer}"
        
        return output
    
    @staticmethod
    def add_section_spacing(text: str) -> str:
        """Ensure proper spacing between sections"""
        import re
        # Ensure sections have proper spacing
        text = re.sub(r'\n(#{1,6}|[🎯💼📊🏘️💰⚠️📋⭐])', r'\n\n\1', text)
        # Remove excessive blank lines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()