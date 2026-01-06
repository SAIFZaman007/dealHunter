from .core_prompt import CORE_SYSTEM_INSTRUCTIONS, build_context
from .deal_hunter_prompt import DEAL_HUNTER
from .underwriting_prompt import UNDERWRITING_PROMPT
from .offer_outreach_prompt import OFFER_OUTREACH_PROMPT
from .examples_prompt import LOW_CAPITAL_EXAMPLE, STRATEGY_COMPARISON_EXAMPLE

__all__ = [
    'CORE_SYSTEM_INSTRUCTIONS',
    'build_context',
    'DEAL_HUNTER',
    'UNDERWRITING_PROMPT',
    'OFFER_OUTREACH_PROMPT',
    'LOW_CAPITAL_EXAMPLE',
    'STRATEGY_COMPARISON_EXAMPLE'
]