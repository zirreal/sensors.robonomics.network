# Руководство по релизам

## Синхронизация версий

Версии синхронизируются между:
- `package.json` (поле `version`)
- Git tags (формат `v{version}`)
- GitHub Releases
- CHANGELOG.md

## Как сделать релиз

### 3 шага

**Шаг 1: Обновите CHANGELOG.md**
   - Откройте `CHANGELOG.md`
   - Добавьте описание новой версии в начало файла (см. формат ниже)
   - Сохраните файл

**Шаг 2: Закоммитьте изменения**
   ```bash
   git add .
   git commit -m "feat: prepare v{version} release"
   ```
   ⚠️ **Важно:** Все изменения должны быть закоммичены перед запуском release-it

**Шаг 3: Запустите release-it**
   ```bash
   # Для багфиксов (4.0.2 -> 4.0.3)
   npm run release:patch

   # Для новых функций (4.0.2 -> 4.1.0)
   npm run release:minor

   # Для breaking changes (4.0.2 -> 5.0.0)
   npm run release:major
   ```

**Готово!** Release-it автоматически:
- ✅ Обновит версию в `package.json`
- ✅ Создаст commit `chore: release v{version}`
- ✅ Создаст git tag `v{version}`
- ✅ Запушит все на GitHub
- ✅ Создаст GitHub Release (если настроен GITHUB_TOKEN)

**Никаких дополнительных команд не требуется!** Release-it делает все автоматически благодаря настройкам в `.release-it.json`.

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

