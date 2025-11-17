# Руководство по релизам

## Синхронизация версий

Версии синхронизируются между:
- `package.json` (поле `version`)
- Git tags (формат `v{version}`)
- GitHub Releases
- CHANGELOG.md

## Как сделать релиз

### Автоматический способ (рекомендуется)

Используйте `release-it` для автоматической синхронизации всех версий:

```bash
# Патч-релиз (1.0.0 -> 1.0.1) - для багфиксов
npm run release:patch

# Минорный релиз (1.0.0 -> 1.1.0) - для новых функций
npm run release:minor

# Мажорный релиз (1.0.0 -> 2.0.0) - для breaking changes
npm run release:major

# Интерактивный выбор версии
npm run release
```

### Что делает release-it:

1. ✅ Проверяет, что рабочая директория чистая (можно отключить в `.release-it.json`)
2. ✅ Запускает линтер (`npm run lint`)
3. ✅ Обновляет версию в `package.json`
4. ✅ Создает git commit с сообщением `chore: release v{version}`
5. ✅ Создает git tag `v{version}`
6. ✅ Создает GitHub Release (если настроен GitHub token)

⚠️ **CHANGELOG.md обновляется вручную** (см. раздел ниже)

### Dry-run (проверка без изменений)

Перед реальным релизом можно проверить, что будет сделано:

```bash
npm run release:dry-run
```

## Обновление CHANGELOG.md

CHANGELOG.md обновляется **вручную** перед каждым релизом.

### Когда обновлять CHANGELOG

**Рекомендуемый порядок действий:**

1. **Перед запуском `release-it`** — обновите CHANGELOG.md с описанием изменений новой версии
2. Запустите `npm run release:patch/minor/major` — release-it обновит версию в package.json и создаст tag
3. После релиза — проверьте, что CHANGELOG соответствует выпущенной версии

### Формат CHANGELOG

Следуйте существующему формату в `CHANGELOG.md`:

```markdown
v{version}

Краткое описание изменений (опционально)

**Категория изменений:**
- Feat: описание новой функции
- Fix: описание исправления
- Refactor: описание рефакторинга
- Remove: описание удаленного функционала
- ...

v{предыдущая версия}
...
```

### Примеры записей

```markdown
v4.0.3

**Bug Fixes:**
- Fix: resolve marker color issue on mobile devices
- Fix: prevent unnecessary API requests on map load

**Improvements:**
- Refactor: optimize sensor data loading
- Feat: add keyboard navigation for tabs

v4.0.2
...
```

### Что включать в CHANGELOG

✅ **Включайте:**
- Новые функции (Feat)
- Исправления багов (Fix)
- Breaking changes (с пометкой)
- Важные рефакторинги (Refactor)
- Удаленный функционал (Remove)
- Изменения в API или конфигурации

❌ **Не включайте:**
- Мелкие правки форматирования
- Обновления зависимостей без функциональных изменений
- Внутренние технические изменения без влияния на пользователей
- WIP (work in progress) изменения

### Полезные команды для подготовки CHANGELOG

```bash
# Посмотреть все коммиты с последнего релиза
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Посмотреть коммиты с деталями
git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"- %s (%h)"

# Посмотреть изменения в файлах
git diff $(git describe --tags --abbrev=0)..HEAD --stat
```

## Ручное обновление версии

Если нужно обновить версию вручную (без release-it):

1. **Обновите CHANGELOG.md** с описанием новой версии
2. Обновите версию в `package.json`
3. Создайте git commit: `git commit -am "chore: release v{version}"`
4. Создайте git tag: `git tag v{version}`
5. Запушьте изменения: `git push origin main && git push origin v{version}`

⚠️ **Рекомендуется использовать `release-it`** для автоматизации шагов 2-5.

## Проверка текущей версии

```bash
# Версия из package.json
npm version

# Последний git tag
git describe --tags --abbrev=0

# Все версии
git tag --sort=-version:refname
```

## Настройка GitHub Release

Для автоматического создания GitHub Release нужен GitHub token:

1. Создайте Personal Access Token с правами `repo`
2. Добавьте в `.env` или экспортируйте:
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```

Или используйте GitHub CLI:
```bash
gh auth login
```

## Troubleshooting

### Версии не совпадают

Если версии разошлись:

1. Проверьте текущую версию: `npm version` и `git describe --tags`
2. Обновите `package.json` до актуальной версии из git tag
3. В будущем используйте `release-it` для автоматизации

### Release-it не работает

Проверьте:
- Установлен ли `release-it`: `npm list release-it`
- Правильно ли настроен `.release-it.json`
- Есть ли права на создание git tags и GitHub releases

