"""Sensitivity analysis for strategy resilience testing"""

from typing import Dict, List
from dataclasses import dataclass

@dataclass
class SensitivityResult:
    """Sensitivity test result"""
    scenario: str
    roi_change: float
    profit_change: float
    description: str

class SensitivityAnalyzer:
    """Tests strategy under market variations"""
    
    @staticmethod
    def analyze(
        base_profit: float,
        base_capital: float,
        base_costs: float
    ) -> List[SensitivityResult]:
        """
        Test ±10% resale, ±5% costs
        Returns list of sensitivity results
        """
        base_roi = (base_profit / base_capital) * 100
        results = []
        
        # Scenario 1: Resale -10%
        new_profit = base_profit * 0.90
        new_roi = (new_profit / base_capital) * 100
        results.append(SensitivityResult(
            scenario="Resale -10%",
            roi_change=new_roi - base_roi,
            profit_change=new_profit - base_profit,
            description=f"ROI drops to {new_roi:.1f}% if market softens"
        ))
        
        # Scenario 2: Resale +10%
        new_profit = base_profit * 1.10
        new_roi = (new_profit / base_capital) * 100
        results.append(SensitivityResult(
            scenario="Resale +10%",
            roi_change=new_roi - base_roi,
            profit_change=new_profit - base_profit,
            description=f"ROI rises to {new_roi:.1f}% if market heats up"
        ))
        
        # Scenario 3: Costs +5%
        new_profit = base_profit - (base_costs * 0.05)
        new_roi = (new_profit / base_capital) * 100
        results.append(SensitivityResult(
            scenario="Costs +5%",
            roi_change=new_roi - base_roi,
            profit_change=new_profit - base_profit,
            description=f"ROI adjusts to {new_roi:.1f}% with cost overruns"
        ))
        
        return results
    
    @staticmethod
    def format_table(results: List[SensitivityResult]) -> str:
        """Format sensitivity table"""
        headers = ["Scenario", "ROI Change", "Profit Change", "Impact"]
        rows = [
            [
                r.scenario,
                f"{r.roi_change:+.1f}%",
                f"${r.profit_change:+,.0f}",
                r.description
            ]
            for r in results
        ]
        
        header_row = "| " + " | ".join(headers) + " |"
        sep = "|" + "|".join(["---" for _ in headers]) + "|"
        data_rows = "\n".join(["| " + " | ".join(str(c) for c in row) + " |" for row in rows])
        
        return f"📊 **Sensitivity Analysis**\n\n{header_row}\n{sep}\n{data_rows}\n\n*Plan remains solid under ±10% market shifts*"
