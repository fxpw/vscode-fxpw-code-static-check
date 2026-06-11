
# vscode fxpw code static check

Расширение VS Code для статических проверок кода и метрик сложности.  
Подсвечивает проблемы со стилем кода, незалокализованные строки, ссылки на OpenAPI-схемы и показывает метрики сложности по функциям прямо в редакторе.

## Возможности

### Проверки PHP и Vue

- **Переменные в `snake_case`** — предупреждение, если имя переменной не соответствует snake_case (`$myVar` → warning)
- **Двойные пробелы** — предупреждение на два и более пробела подряд
- **Пробел в конце строки** — предупреждение на пробел перед переносом строки
- **Кириллица в строковых литералах** — предупреждение, если строка содержит кириллический текст без обёртки в хелпер локализации
- **Метрики по каждой функции** — подсветка `Cognitive Complexity` и `Cyclomatic Complexity`; при превышении порогов показывается `warning`

Проверки работают для файлов `.php` и `.vue`. Файлы внутри директорий `lang/` автоматически исключаются.

### Метрики сложности по функциям

- Поддерживаемые языки: `PHP`, `JavaScript`, `TypeScript`, `Lua`, `C++`
- Для каждой найденной функции рассчитываются:
  - `Cognitive Complexity`
  - `Cyclomatic Complexity`
- Пороговые значения предупреждений настраиваются через settings

### Проверки Blade-шаблонов

- Устаревшие PHP-теги (`<?php`, `<?=`, `?>`) внутри `.blade.php` файлов
- Двойные пробелы и пробелы в конце строки
- Кириллический текст без обёртки в хелпер локализации

### Hover и навигация по OpenAPI-схемам

При работе с PHP-файлами, использующими атрибуты [zircote/swagger-php](https://github.com/zircote/swagger-php):

- **Hover** — при наведении на ссылку `#/components/schemas/SomeName` (в PHP, Blade, JSON, YAML) появляется всплывающая подсказка с заголовком, описанием, типом схемы и всеми полями (с типами, описаниями, примерами, `$ref`, `items`, `oneOf`/`anyOf`/`allOf`)
- **Переход к определению** — Ctrl+Click или F12 на той же ссылке переходит к атрибуту `#[OA\Schema(` в PHP-файле; если схема с таким именем определена в нескольких файлах — появляется список для выбора

## Настройки

| Настройка | По умолчанию | Описание |
|---|---|---|
| `vscode-fxpw-code-static-check.phpCode` | `true` | Включить проверки PHP / Vue |
| `vscode-fxpw-code-static-check.bladeTemplates` | `true` | Включить проверки Blade-шаблонов |
| `vscode-fxpw-code-static-check.localization` | `true` | Предупреждать о незалокализованной кириллице |
| `vscode-fxpw-code-static-check.complexityMetrics` | `true` | Включить метрики сложности по функциям |
| `vscode-fxpw-code-static-check.cognitiveComplexityWarningThreshold` | `15` | Порог warning для Cognitive Complexity |
| `vscode-fxpw-code-static-check.cyclomaticComplexityWarningThreshold` | `10` | Порог warning для Cyclomatic Complexity |
| `vscode-fxpw-code-static-check.openApiSchemaHover` | `true` | Показывать hover и переход к определению для ссылок на OpenAPI-схемы |
| `vscode-fxpw-code-static-check.debug` | `false` | Выводить отладочные сообщения в консоль разработчика |

## Версионирование

Версия формируется автоматически при каждом push в `main`: `1.0.{github.run_number}`.

См. [CHANGELOG.md](CHANGELOG.md) для полной истории изменений.
