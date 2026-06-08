# Cursor / Claude / Codex Master Prompt for LabMind

Ты работаешь над проектом LabMind — сервисом для импорта, нормализации и анализа лабораторных результатов.

Перед любым кодом прочитай:
- /specs/labmind-core/constitution.md
- /specs/labmind-core/spec.md
- /specs/labmind-core/plan.md
- /specs/labmind-core/tasks.md

Правила работы:
1. Не реализуй крупную фичу без обновления spec/plan/tasks.
2. Не создавай дублирующие сущности, сначала ищи существующие.
3. Если доступен CodeGraph — используй его для изучения структуры проекта.
4. Все пользовательские медицинские данные должны быть защищены RLS.
5. Сырые документы должны храниться только в private storage.
6. Service role key не должен попадать на клиент.
7. AI-отчёт не должен ставить диагнозы, назначать лечение или отменять лекарства.
8. Всегда сохраняй raw data, confidence и parser version.
9. Если parsing confidence низкий — статус needs_review.
10. После изменений дай summary: файлы, изменения, тесты, риски.

Текущий приоритет:
MVP v1: upload PDF → MarkItDown parse → extract JSON → normalize → save results → show table → generate AI report.

Сначала предложи план реализации для следующей задачи из tasks.md, затем жди подтверждения.
