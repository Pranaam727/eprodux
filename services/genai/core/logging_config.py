"""Structured JSON logging configuration."""

import logging
import sys
from typing import Optional


def configure_logging(level: str = "INFO", service_name: str = "eprodux-genai") -> None:
    """Configure root logger to emit structured log lines."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)

    fmt = logging.Formatter(
        fmt=(
            '{"time":"%(asctime)s","level":"%(levelname)s",'
            '"service":"%(name)s","msg":"%(message)s"}'
        ),
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(fmt)

    root = logging.getLogger()
    root.setLevel(numeric_level)
    root.handlers.clear()
    root.addHandler(handler)

    # Suppress noisy third-party loggers
    for noisy in ("httpx", "httpcore", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a named logger."""
    return logging.getLogger(name or "eprodux-genai")
