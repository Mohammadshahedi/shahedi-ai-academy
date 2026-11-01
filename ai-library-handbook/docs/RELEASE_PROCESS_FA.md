# فرایند انتشار

1. `node scripts/content-audit.mjs`
2. `pytest -q`
3. `python release_gate.py`
4. Gate متناسب با Staging یا Production
5. Backup پیش از Deploy
6. Deploy، Readiness و Smoke Test
7. Rollback در صورت شکست
8. ثبت SHA، گزارش و Sign-off
