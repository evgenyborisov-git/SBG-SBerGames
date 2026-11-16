# Восстановление компактной резервной копии Google Drive

16 ноября 2026, МСК. Внешняя папка: ChatGPT/SberSeller_Chudozveri.

Большое число архивов не означает, что это разные актуальные версии. В прежнем комплекте ZIP исходников, ZIP 1×, ZIP 2× и Git bundle дублировали те же файлы. Полное восстановление из трёх частей bundle и накопительного дополнения проверено отдельно: клонирован репозиторий, применено дополнение, git fsck --full, все 386 файлов версии 16 сверены с Git blob SHA. Включая исходную графику, 1×/2×, шрифты, код и историю.

Нужные файлы:

1. SberSeller_a33908c_history.bundle.part01
2. SberSeller_a33908c_history.bundle.part02
3. SberSeller_a33908c_history.bundle.part03
4. Последний накопительный ZIP обновления (актуальный файл указан в SberSeller_RESTORE_CURRENT.md на Drive).
5. SberSeller_RESTORE_CURRENT.md и SberSeller_BACKUP_SHA256.json.

Дополнительно хранятся презентация и исходный handoff с незавершёнными рабочими деревьями. Их не удаляем: handoff содержит материалы вне обычного коммита.

## Порядок

Сначала проверить SHA256 трёх частей по текущему JSON. Объединить их:

```sh
cat SberSeller_a33908c_history.bundle.part01 SberSeller_a33908c_history.bundle.part02 SberSeller_a33908c_history.bundle.part03 > history.bundle
git clone history.bundle restored
```

На Windows cmd вместо cat:

```text
copy /b SberSeller_a33908c_history.bundle.part01+SberSeller_a33908c_history.bundle.part02+SberSeller_a33908c_history.bundle.part03 history.bundle
```

Распаковать актуальный ZIP в отдельную папку, проверить его внутренний SHA256.json. В restored выполнить `git fetch /абсолютный/путь/к/распакованному/update.bundle HEAD` (точное имя bundle — внутри ZIP) и `git merge --ff-only FETCH_HEAD`, затем `git fsck --full`.

Клонирование восстанавливает все исходники и все варианты графики. Отдельные старые source.zip/retina_1x.zip/retina_2x.zip больше не нужны. В обновлении также есть актуальная сборка. Старый build.zip не нужен для восстановления новой версии.

Далее npm ci, npm test, npm run typecheck, npm run build. Секреты и привязку live D1 настраивать отдельно; архив кода не является резервной копией пользовательской базы. Саму существующую Sites D1 не удалять.

Удаление выполняется только после проверки новой копии, её загрузки и актуализации инструкции/контрольных сумм. Три базовые части нельзя удалять по отдельности: последний ZIP является дополнением к ним, а не заменой полной истории.
