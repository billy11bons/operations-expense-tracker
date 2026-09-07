# Operations and Expense Tracker

Учебный MVP по реальному заказу Upwork для ежедневного учёта расходов и рабочих задач малого бизнеса.

## Стек

- Next.js 16.3.4
- React 19.2.8
- TypeScript 7.0.2
- Tailwind CSS 4.3.3
- localStorage в браузере

## Установка и запуск

```powershell
cd 'E:\Prompt\Freelance\Trecker\Case_01_Operations_Expense_Tracker\app'
npm.cmd ci
npm.cmd run dev
```

Откройте http://127.0.0.1:3000. Для production-проверки используйте `npm.cmd run build`, затем после остановки dev-сервера — `npm.cmd run start`.

## Структура

- `app/src/app/page.tsx` — Dashboard.
- `app/src/app/expenses/page.tsx` — расходы и фильтры.
- `app/src/app/tasks/page.tsx` — задачи, статусы и фильтры.
- `app/src/app/settings/page.tsx` — категории.
- `app/src/lib/domain.ts` — типы, расчёты, валидация и демоданные.
- `app/src/components/` — общая оболочка, хранилище, формы и диалоги.
- `app/tests/domain.test.ts` — тесты денежных и календарных правил.

## Функции

Расходы и задачи поддерживают создание, редактирование и удаление. Для задач доступны New, In Progress, Pending и Done, приоритеты Low, Medium и High, отметки Pending/Overdue и смена статуса прямо в списке. Dashboard показывает сумму текущей недели, Pending, overdue и completed. Расходы фильтруются по периоду и категории, задачи — по статусу и приоритету. Данные сохраняются локально и инициализируются демоданными только при первом открытии.

## Тестирование

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Технические проверки этапов 2–4, browser smoke, screenshots и регрессионный отчёт находятся в `verification/`. Тесты используют изолированные браузерные профили.

## Ограничения

Один браузер и один оператор, без авторизации, cloud sync, Google Sheets API, импорта исходной таблицы, экспорта, уведомлений, платежей и публикации. Используется одна учебная валюта USD. Очистка данных браузера удаляет локальные записи. Публикация и GitHub требуют отдельного разрешения и на текущем этапе не выполнялись.
