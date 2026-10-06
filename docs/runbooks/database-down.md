# SRE Runbook: Database (Postgres) Down

## أعراض العطل (Symptoms)
- توقف منصة MOSA بالكامل (رسائل 500 Internal Server Error).
- فشل تسجيل الدخول للعملاء الجدد (توقف المصادقة).
- تنبيه `API_High_Error_Rate` من Prometheus.

## التشخيص (Diagnosis)
1. فحص حالة الحاوية: `docker ps -a | grep mosa-postgres`.
2. فحص السجلات: `docker logs mosa-postgres --tail 100`. 
3. تحقق مما إذا كانت المشكلة بسبب مساحة القرص (`Out of space`) أو الذاكرة الممتلئة (OOM Killed).

## الحل السريع (Mitigation)
1. إعادة تشغيل القاعدة: `docker restart mosa-postgres`.
2. في حال فشل الإقلاع بسبب فساد البيانات (Data Corruption)، انتقل إلى `restore-backup.md`.
