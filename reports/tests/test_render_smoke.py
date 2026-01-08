from pathlib import Path
import pandas as pd

from diario.scoring import build_kpis
from diario.loaders import DataBundle
from diario.render import render_all

def test_render_smoke(tmp_path: Path):
    daily = pd.DataFrame([{"date":"2026-01-07","sleep_hours":7,"energy":7,"focus_minutes":120,"alcohol_units":0,"stalk_intensity":0,"feature_done":True}])
    checkins = pd.DataFrame([{"date":"2026-01-07","question":"q","intensity_0_10":5}])
    pomodoro = pd.DataFrame([{"date":"2026-01-07","event":"end","phase":"work","cycle":1}])

    data = DataBundle(daily=daily, checkins=checkins, pomodoro=pomodoro)
    kpis = build_kpis(data)
    render_all(tmp_path, kpis, data, tz="America/Santiago")

    assert (tmp_path / "index.html").exists()
    assert (tmp_path / "assets" / "heatmap.png").exists()
