"""
Strategy Ranking System - Automated comparison of multiple plans
"""

from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class InvestmentStrategy:
    """Data class for investment strategy"""
    name: str
    location: str
    capital: float
    timeline_months: int
    total_profit: float
    deals_needed: int
    risk_low_pct: float
    risk_moderate_pct: float
    risk_aggressive_pct: float
    
    @property
    def roi_percentage(self) -> float:
        """Calculate ROI percentage"""
        return (self.total_profit / self.capital) * 100 if self.capital > 0 else 0
    
    @property
    def monthly_profit_rate(self) -> float:
        """Calculate monthly profit rate"""
        return self.total_profit / self.timeline_months if self.timeline_months > 0 else 0
    
    @property
    def risk_balance_score(self) -> float:
        """Calculate risk balance score (lower is better)"""
        # Penalize excessive aggressive risk
        return (
            (self.risk_low_pct * 0.5) +
            (self.risk_moderate_pct * 1.0) +
            (self.risk_aggressive_pct * 2.0)
        )

class StrategyRanker:
    """Ranks multiple investment strategies"""
    
    # Weighting factors
    WEIGHT_ROI = 0.70
    WEIGHT_RISK = 0.20
    WEIGHT_TIMELINE = 0.10
    
    @staticmethod
    def calculate_score(strategy: InvestmentStrategy) -> float:
        """Calculate composite score for ranking"""
        
        # ROI score (normalized to 0-100)
        roi_score = min(strategy.roi_percentage / 10, 100)  # Cap at 1000% ROI
        
        # Risk score (inverse of risk balance, normalized)
        risk_score = max(0, 100 - strategy.risk_balance_score)
        
        # Timeline score (faster is better, normalized)
        timeline_score = max(0, 100 - (strategy.timeline_months * 5))
        
        # Weighted composite
        composite = (
            (roi_score * StrategyRanker.WEIGHT_ROI) +
            (risk_score * StrategyRanker.WEIGHT_RISK) +
            (timeline_score * StrategyRanker.WEIGHT_TIMELINE)
        )
        
        return composite
    
    @staticmethod
    def rank_strategies(strategies: List[InvestmentStrategy]) -> List[tuple]:
        """
        Rank strategies and return sorted list
        
        Returns:
            List of (strategy, score) tuples, sorted best to worst
        """
        scored = [(s, StrategyRanker.calculate_score(s)) for s in strategies]
        return sorted(scored, key=lambda x: x[1], reverse=True)
    
    @staticmethod
    def generate_comparison_table(strategies: List[InvestmentStrategy]) -> str:
        """Generate markdown comparison table"""
        headers = [
            "Factor",
            *[f"Plan {chr(65+i)}: {s.location}" for i, s in enumerate(strategies)]
        ]
        
        rows = [
            ["Capital Required", *[f"${s.capital:,.0f}" for s in strategies]],
            ["Timeline", *[f"{s.timeline_months} months" for s in strategies]],
            ["Deals Needed", *[f"{s.deals_needed}" for s in strategies]],
            ["Total Profit", *[f"${s.total_profit:,.0f}" for s in strategies]],
            ["ROI", *[f"{s.roi_percentage:.0f}%" for s in strategies]],
            ["Risk Balance", *[f"{s.risk_low_pct:.0f}% L / {s.risk_moderate_pct:.0f}% M / {s.risk_aggressive_pct:.0f}% A" for s in strategies]],
        ]
        
        # Build table
        header_row = "| " + " | ".join(headers) + " |"
        separator = "|" + "|".join(["---" for _ in headers]) + "|"
        data_rows = "\n".join(["| " + " | ".join(str(cell) for cell in row) + " |" for row in rows])
        
        return f"{header_row}\n{separator}\n{data_rows}"
    
    @staticmethod
    def generate_recommendation(
        strategies: List[InvestmentStrategy],
        ranked: List[tuple]
    ) -> str:
        """Generate recommendation text"""
        winner, winner_score = ranked[0]
        
        recommendation = f"""⭐ **Recommendation: Plan A ({winner.location})**

**Composite Score: {winner_score:.1f}/100**

**3 Key Advantages:**

1. **ROI Performance**: {winner.roi_percentage:.0f}% cash-on-cash return
2. **Risk Balance**: {winner.risk_low_pct:.0f}% Low / {winner.risk_moderate_pct:.0f}% Moderate / {winner.risk_aggressive_pct:.0f}% Aggressive
3. **Timeline Efficiency**: {winner.timeline_months} months to ${winner.total_profit:,.0f} target

**When to Consider Alternatives:**
"""
        
        # Suggest when other plans might be better
        for i, (strategy, score) in enumerate(ranked[1:], 1):
            if strategy.roi_percentage > winner.roi_percentage:
                recommendation += f"- Choose Plan {chr(65+i)} if you prioritize maximum ROI ({strategy.roi_percentage:.0f}% vs {winner.roi_percentage:.0f}%)\n"
            elif strategy.timeline_months < winner.timeline_months:
                recommendation += f"- Choose Plan {chr(65+i)} if speed is critical ({strategy.timeline_months} vs {winner.timeline_months} months)\n"
            elif strategy.risk_balance_score < winner.risk_balance_score:
                recommendation += f"- Choose Plan {chr(65+i)} if minimizing risk is priority (lower risk profile)\n"
        
        return recommendation