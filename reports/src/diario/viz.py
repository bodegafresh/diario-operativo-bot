from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

def make_heatmap_png(heat: pd.DataFrame, out_path: str | Path) -> None:
    """
    Simple heatmap:
    - rows: dates
    - cols: metrics (normalized per-column)
    """
    if heat.empty:
        # create a placeholder
        fig = plt.figure(figsize=(8, 2))
        plt.text(0.5, 0.5, "No data yet", ha="center", va="center")
        plt.axis("off")
        fig.savefig(out_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        return

    df = heat.copy()
    # Convert to numeric matrix
    mat = df.to_numpy(dtype=float)
    # Normalize columns (z-score, robust-ish)
    col_mean = np.nanmean(mat, axis=0)
    col_std = np.nanstd(mat, axis=0)
    col_std[col_std == 0] = 1.0
    norm = (mat - col_mean) / col_std
    # Clip for nicer colors
    norm = np.clip(norm, -2.5, 2.5)

    fig = plt.figure(figsize=(max(6, df.shape[1]*1.1), max(2.5, df.shape[0]*0.35)))
    ax = plt.gca()
    im = ax.imshow(norm, aspect="auto", interpolation="nearest")

    ax.set_yticks(range(len(df.index)))
    ax.set_yticklabels([str(d) for d in df.index], fontsize=8)
    ax.set_xticks(range(len(df.columns)))
    ax.set_xticklabels([str(c) for c in df.columns], rotation=30, ha="right", fontsize=9)

    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Normalized")
    plt.tight_layout()
    fig.savefig(out_path, dpi=160, bbox_inches="tight")
    plt.close(fig)
