const LANG_KEY = 'doughflow_lang_v1';

export const LANGUAGES = {
  en: 'English',
  ru: 'Русский',
  ky: 'Кыргызча'
};

const DICT = {
  en: {},
  ru: {
    'Dashboard':'Панель','Production':'Производство','Recipe':'Рецепт','Inventory':'Склад','Reports':'Отчёты','Users':'Пользователи','Naan':'Наан / Лепёшка','Naan / Leposhka Maker':'Изготовитель наана / лепёшки','Sales':'Продажи','Salesman':'Продавец','Hamurchi':'Хамурчи','Admin':'Администратор','Full':'Полный доступ','Role-limited':'Ограниченный доступ','Log out':'Выйти','Sign in':'Войти','Email':'Электронная почта','Password':'Пароль','Production + inventory management for your bakery workflow.':'Управление производством и складом для вашего рабочего процесса.','Demo mode is active. Choose a role below. Real multi-user login is enabled after you connect Supabase.':'Включён демонстрационный режим. Выберите роль ниже. Настоящий многопользовательский вход будет доступен после подключения Supabase.','Good morning':'Доброе утро','Good day':'Добрый день','role:':'роль:','+ Production':'+ Производство','Today’s mishoks':'Мишоки сегодня','Today’s pieces':'Штуки сегодня','Production runs':'Производственные смены','Recipe version':'Версия рецепта','Stock snapshot':'Состояние склада','Material':'Материал','Stock':'Остаток','Status':'Статус','Out':'Нет','Low':'Мало','OK':'Норма','Quick rules':'Быстрые правила','1 operational mishok is always counted as':'1 рабочий мишок всегда считается как','even when the flour is around 48–52 kg. Half mishok is':'даже если мука около 48–52 кг. Половина мишока —','even around 24–27 kg. Piece count is always actual and editable.':'даже около 24–27 кг. Количество штук всегда фактическое и редактируемое.','Today':'Сегодня','Enter your mishoks and actual pieces from the Production panel.':'Введите мишоки и фактическое количество штук в панели производства.','You may update the working recipe. Future production uses the new version.':'Вы можете изменить рабочий рецепт. Будущее производство использует новую версию.','Panel ready. We will add the exact process after you provide it.':'Панель готова. Мы добавим точный процесс после того, как вы его предоставите.','Panel is reserved and protected.':'Панель зарезервирована и защищена.','Production panel':'Панель производства','Enter mishoks and actual pieces. Expected consumption is calculated from the current recipe and remains editable.':'Введите мишоки и фактическое количество штук. Ожидаемый расход рассчитывается по текущему рецепту и остаётся редактируемым.','New production':'Новое производство','Mishok count':'Количество мишоков','Batches':'Партии','Material consumption':'Расход материалов','Complete production':'Завершить производство','Clear':'Очистить','Mishok is an operational unit. Full = 1.0, half = 0.5. Actual batch flour may be around 48–52 kg (or half-batch around 24–27 kg) without changing the mishok count.':'Мишок — рабочая единица. Полный = 1,0, половина = 0,5. Фактическая масса муки может быть около 48–52 кг (или 24–27 кг для половины) без изменения количества мишоков.','Today’s production':'Производство сегодня','Time':'Время','Mishok':'Мишок','Pieces':'Штуки','Recipe':'Рецепт','No production saved today.':'Сегодня производство ещё не сохранено.','Actual pieces':'Фактические штуки','expected':'ожидается','Actual':'Фактически','Expected consumption':'Ожидаемый расход','Current standard':'Текущий стандарт','Save as new recipe version':'Сохранить как новую версию рецепта','Working recipe per operational mishok. Authorized production users can edit it.':'Рабочий рецепт на один операционный мишок. Уполномоченные производственные пользователи могут его изменять.','Packaging rules':'Правила упаковки','Purchase package':'Упаковка закупки','Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.':'Вода — один материал. Соль: пачки 1 кг и 750 г. Дрожжи: пакеты 500 г и коробки по 20 пакетов. Масло: коробки по 20 кг.','Current theoretical stock plus package-aware receiving.':'Текущий расчётный запас с учётом упаковок при приёмке.','+ Stock in':'+ Приход','Material details':'Детали материалов','Package options':'Варианты упаковки','Receive stock':'Принять товар','Package':'Упаковка','Number of packages':'Количество упаковок','Notes':'Примечание','Cancel':'Отмена','Add stock':'Добавить','The system will convert package quantity into the inventory base unit.':'Система автоматически переведёт количество упаковок в базовую единицу склада.','Operational summary from saved production.':'Операционный итог по сохранённому производству.','All-time mishoks':'Мишоки за всё время','All-time pieces':'Штуки за всё время','Pieces / mishok':'Штук / мишок','Production history':'История производства','Worker':'Работник','No production yet.':'Производства ещё нет.','Four role model. User creation can be managed in Supabase Auth + profiles.':'Четыре роли. Пользователи управляются через Supabase Auth и профили.','Access':'Доступ','No active recipe found. Run the database seed SQL first.':'Активный рецепт не найден. Сначала выполните SQL-инициализацию базы данных.','Recipe quantities must be valid non-negative numbers.':'Количество ингредиентов должно быть корректными неотрицательными числами.','Recipe saved as':'Рецепт сохранён как','Production saved.':'Производство сохранено.','Enter a valid mishok count.':'Введите корректное количество мишоков.','No active recipe found.':'Активный рецепт не найден.','Piece counts cannot be negative.':'Количество штук не может быть отрицательным.','Consumption values must be valid non-negative numbers.':'Значения расхода должны быть корректными неотрицательными числами.','Saved':'Сохранено','User':'Пользователь','Flour':'Мука','Water':'Вода','Oil':'Масло','Salt':'Соль','Sugar':'Сахар','Yeast':'Дрожжи','Bulk':'Навалом','20 kg carton':'Коробка 20 кг','1 kg packet':'Пакет 1 кг','750 g packet':'Пакет 750 г','20 × 1 kg bundle':'Связка 20 × 1 кг','500 g packet':'Пакет 500 г','20 × 500 g box':'Коробка 20 × 500 г','1 operational mishok; actual batch can be 48–52 kg and is still counted as 1 mishok':'1 рабочий мишок; фактическая партия может быть 48–52 кг и всё равно считается как 1 мишок','Combined water; no hot/cold split':'Общая вода; без разделения на горячую и холодную','Standard 20 kg carton packaging':'Стандартная коробка 20 кг','Default 45 g; operational range 35–55 g':'По умолчанию 45 г; рабочий диапазон 35–55 г','1 kg or 750 g packets':'Пакеты 1 кг или 750 г','Production consumption':'Расход на производство','Stock received':'Приход товара','Supplier / delivery note':'Поставщик / примечание к поставке'
  },
  ky: {
    'Dashboard':'Башкаруу панели','Production':'Өндүрүш','Recipe':'Рецепт','Inventory':'Кампа','Reports':'Отчёттор','Users':'Колдонуучулар','Naan':'Нан / Лепёшка','Naan / Leposhka Maker':'Нан / лепёшка жасоочу','Sales':'Сатуу','Salesman':'Сатуучу','Hamurchi':'Хамурчи','Admin':'Администратор','Full':'Толук мүмкүнчүлүк','Role-limited':'Чектелген мүмкүнчүлүк','Log out':'Чыгуу','Sign in':'Кирүү','Email':'Электрондук почта','Password':'Сырсөз','Production + inventory management for your bakery workflow.':'Нан бышыруу ишиңиз үчүн өндүрүш жана кампа башкаруусу.','Demo mode is active. Choose a role below. Real multi-user login is enabled after you connect Supabase.':'Демо режими күйгүзүлдү. Төмөндөн ролду тандаңыз. Чыныгы көп колдонуучулук кирүү Supabase туташкандан кийин иштейт.','Good morning':'Кутман таң','Good day':'Кутмандуу күн','role:':'ролу:','+ Production':'+ Өндүрүш','Today’s mishoks':'Бүгүнкү мишоктор','Today’s pieces':'Бүгүнкү даана','Production runs':'Өндүрүш иштери','Recipe version':'Рецепттин версиясы','Stock snapshot':'Кампанын абалы','Material':'Материал','Stock':'Калдык','Status':'Абалы','Out':'Жок','Low':'Аз','OK':'Норма','Quick rules':'Тез эрежелер','Today':'Бүгүн','Enter your mishoks and actual pieces from the Production panel.':'Өндүрүш панелинен мишокторду жана чыныгы дааналарды киргизиңиз.','You may update the working recipe. Future production uses the new version.':'Иштеп жаткан рецептти өзгөртө аласыз. Кийинки өндүрүш жаңы версияны колдонот.','Panel ready. We will add the exact process after you provide it.':'Панель даяр. Так процессти сиз бергенден кийин кошобуз.','Panel is reserved and protected.':'Бул панель резервде жана корголгон.','Enter mishoks and actual pieces. Expected consumption is calculated from the current recipe and remains editable.':'Мишокторду жана чыныгы дааналарды киргизиңиз. Күтүлгөн керектөө учурдагы рецепттен эсептелет жана өзгөртүлө алат.','New production':'Жаңы өндүрүш','Mishok count':'Мишок саны','Batches':'Партиялар','Material consumption':'Материал керектөөсү','Complete production':'Өндүрүштү бүтүрүү','Clear':'Тазалоо','Mishok is an operational unit. Full = 1.0, half = 0.5. Actual batch flour may be around 48–52 kg (or half-batch around 24–27 kg) without changing the mishok count.':'Мишок — иштик бирдик. Толук = 1,0, жарымы = 0,5. Ундун чыныгы салмагы 48–52 кг (же жарым партияда 24–27 кг) болушу мүмкүн жана мишок саны өзгөрбөйт.','Today’s production':'Бүгүнкү өндүрүш','Time':'Убакыт','Mishok':'Мишок','Pieces':'Даана','No production saved today.':'Бүгүн өндүрүш сакталган жок.','Actual pieces':'Чыныгы даана','expected':'күтүлгөн','Actual':'Чыныгы','Current standard':'Учурдагы стандарт','Save as new recipe version':'Жаңы рецепт версиясы катары сактоо','Working recipe per operational mishok. Authorized production users can edit it.':'Бир иштик мишок үчүн жумушчу рецепт. Ыйгарым укуктуу өндүрүш кызматкерлери өзгөртө алат.','Packaging rules':'Таңгактоо эрежелери','Purchase package':'Сатып алуу таңгагы','Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.':'Суу бир эле материал. Туз: 1 кг жана 750 г пакет. Ачыткы: 500 г пакет жана 20 пакеттик куту. Май: 20 кг куту.','Current theoretical stock plus package-aware receiving.':'Учурдагы эсептик калдык жана таңгак боюнча киргизүү.','+ Stock in':'+ Кампага киргизүү','Material details':'Материалдардын маалыматы','Package options':'Таңгак варианттары','Receive stock':'Товар кабыл алуу','Package':'Таңгак','Number of packages':'Таңгак саны','Notes':'Эскертүү','Cancel':'Жокко чыгаруу','Add stock':'Кошуу','The system will convert package quantity into the inventory base unit.':'Система таңгак санын автоматтык түрдө кампанын негизги бирдигине которот.','Operational summary from saved production.':'Сакталган өндүрүш боюнча оперативдүү жыйынтык.','All-time mishoks':'Бардык мишоктор','All-time pieces':'Бардык даана','Pieces / mishok':'Даана / мишок','Production history':'Өндүрүш тарыхы','Worker':'Кызматкер','No production yet.':'Азырынча өндүрүш жок.','Four role model. User creation can be managed in Supabase Auth + profiles.':'Төрт роль. Колдонуучулар Supabase Auth жана профилдер аркылуу башкарылат.','Access':'Мүмкүнчүлүк','No active recipe found. Run the database seed SQL first.':'Активдүү рецепт табылган жок. Адегенде маалымат базасын SQL аркылуу баштаңыз.','Recipe quantities must be valid non-negative numbers.':'Рецепттеги сандар туура жана терс эмес болушу керек.','Recipe saved as':'Рецепт төмөнкү версия катары сакталды','Production saved.':'Өндүрүш сакталды.','Enter a valid mishok count.':'Туура мишок санын киргизиңиз.','No active recipe found.':'Активдүү рецепт табылган жок.','Piece counts cannot be negative.':'Даана саны терс боло албайт.','Consumption values must be valid non-negative numbers.':'Керектөө маанилери туура жана терс эмес болушу керек.','Saved':'Сакталды','User':'Колдонуучу','Flour':'Ун','Water':'Суу','Oil':'Май','Salt':'Туз','Sugar':'Кант','Yeast':'Ачыткы','Bulk':'Дүң','20 kg carton':'20 кг куту','1 kg packet':'1 кг пакет','750 g packet':'750 г пакет','20 × 1 kg bundle':'20 × 1 кг байлам','500 g packet':'500 г пакет','20 × 500 g box':'20 × 500 г куту','1 operational mishok; actual batch can be 48–52 kg and is still counted as 1 mishok':'1 иштик мишок; партиянын чыныгы салмагы 48–52 кг болуп, баары бир 1 мишок болуп эсептелет','Combined water; no hot/cold split':'Жалпы суу; ысык/муздак болуп бөлүнбөйт','Standard 20 kg carton packaging':'Стандарттык 20 кг куту','Default 45 g; operational range 35–55 g':'Демейки 45 г; иштик диапазон 35–55 г','1 kg or 750 g packets':'1 кг же 750 г пакет','Production consumption':'Өндүрүш керектөөсү','Stock received':'Товар кириши','Supplier / delivery note':'Жеткирүүчү / жеткирүү эскертүүсү'
  }
};


Object.assign(DICT.ru, {
  'Language':'Язык','Username':'Имя пользователя','Welcome back':'С возвращением',
  'Kyrgyz bakery portal':'Портал кыргызской пекарни',
  'Sign in to manage production, recipes and stock.':'Войдите для управления производством, рецептами и складом.',
  'Let’s make great leposhka today!':'Давайте сегодня испечём отличные лепёшки!',
  'Today’s':'Сегодня','Sacks':'Мешков','Sack':'Мешок','Pieces':'Штук','Runs':'Производств','Version':'Версия',
  'New Production':'Новое производство','Select total sacks (you can add 0.5)':'Выберите общее количество мешков (можно добавить 0,5)',
  'Sack Count':'Количество мешков','Recipe':'Рецепт','per 1 sack':'на 1 мешок',
  'Automatically calculated':'Рассчитывается автоматически','Start Production':'Начать производство',
  'Calculate ingredients and enter pieces':'Рассчитать ингредиенты и ввести количество штук',
  'Stock Overview':'Обзор склада','Current available stock in inventory':'Текущие запасы на складе',
  'View All':'Посмотреть всё','Designed & built with care':'Создано с заботой',
  'Reset':'Сбросить','Total':'Итого','English':'Английский','Russian':'Русский','Kyrgyz':'Кыргызский',
  'Sack count must be between 0.5 and 9.5.':'Количество мешков должно быть от 0,5 до 9,5.',
  'A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.':'Полный мешок = 1,0. Кнопка +0,5 добавляет половину мешка: 6 + 0,5 = 6,5. Максимум — 9,5 мешка.',
  'Kyrgyz bakery workflow':'Рабочий процесс кыргызской пекарни',
  'Bishkek':'Бишкек'
});
Object.assign(DICT.ky, {
  'Language':'Тил','Username':'Колдонуучу аты','Welcome back':'Кайра келиңиз',
  'Kyrgyz bakery portal':'Кыргыз наабайканасынын порталы',
  'Sign in to manage production, recipes and stock.':'Өндүрүштү, рецепттерди жана кампаңызды башкаруу үчүн кириңиз.',
  'Let’s make great leposhka today!':'Бүгүн даамдуу лепёшка жасайлы!',
  'Today’s':'Бүгүнкү','Sacks':'Кап','Sack':'Кап','Pieces':'Даана','Runs':'Өндүрүштөр','Version':'Версиясы',
  'New Production':'Жаңы өндүрүш','Select total sacks (you can add 0.5)':'Жалпы кап санын тандаңыз (0,5 кошсо болот)',
  'Sack Count':'Каптын саны','Recipe':'Рецепт','per 1 sack':'1 капка',
  'Automatically calculated':'Автоматтык эсептелет','Start Production':'Өндүрүштү баштоо',
  'Calculate ingredients and enter pieces':'Ингредиенттерди эсептеп, даананы киргизиңиз',
  'Stock Overview':'Кампанын абалы','Current available stock in inventory':'Камдагы жеткиликтүү калдык',
  'View All':'Баарын көрүү','Designed & built with care':'Көңүл коюу менен жасалды',
  'Reset':'Калыбына келтирүү','Total':'Жалпы','English':'Англисче','Russian':'Орусча','Kyrgyz':'Кыргызча',
  'Sack count must be between 0.5 and 9.5.':'Каптын саны 0,5тен 9,5ке чейин болушу керек.',
  'A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.':'Толук кап = 1,0. +0,5 баскычы жарым кап кошот: 6 + 0,5 = 6,5. Максимум — 9,5 кап.',
  'Kyrgyz bakery workflow':'Кыргыз наабайканасынын иш процесси','Bishkek':'Бишкек'
});


Object.assign(DICT.ru, {
  'Daily workflow':'Ежедневный процесс',
  'Select sacks, add a half-sack when needed, enter actual pieces, then complete.':'Выберите мешки, при необходимости добавьте 0,5 мешка, введите фактическое количество штук и завершите.',
  'New production':'Новое производство','Today’s production':'Производство сегодня','Batches':'Партии',
  'Material consumption':'Расход материалов','Actual pieces':'Фактическое количество штук',
  'Expected consumption':'Ожидаемый расход','Actual':'Фактически','Expected':'Ожидается',
  'Complete production':'Завершить производство','Clear':'Очистить','No production saved today.':'Сегодня производство ещё не сохранено.',
  'Current theoretical stock plus package-aware receiving.':'Текущий расчётный запас с учётом упаковок при приёмке.',
  'Stock & inventory':'Склад и запасы','See balances and stock movements':'Остатки и движения запасов',
  'Review production and usage':'Производство и расход','Manage staff and roles':'Управление персоналом и ролями',
  'Open the naan workflow':'Открыть процесс наана / лепёшки','Open the sales workspace':'Открыть рабочее место продаж',
  'Edit the working recipe':'Изменить рабочий рецепт','Sign out from this device':'Выйти с этого устройства',
  'Everything else':'Остальные разделы','Keep the daily workflow focused. Less-used tools live here.':'Основной рабочий процесс остаётся простым. Редко используемые инструменты находятся здесь.',
  'Admin access only.':'Только для администратора.','Panel reserved':'Панель зарезервирована',
  'This panel is reserved for the exact workflow you will provide next.':'Этот раздел зарезервирован для точного рабочего процесса, который вы предоставите позже.',
  'Open the sales workspace':'Открыть рабочее место продаж','Open the naan workflow':'Открыть процесс наана / лепёшки',
  'No active recipe found. Run the database seed SQL first.':'Активный рецепт не найден. Сначала выполните SQL-инициализацию базы данных.',
  'Recipe saved as':'Рецепт сохранён как','Production saved.':'Производство сохранено.'
});
Object.assign(DICT.ky, {
  'Daily workflow':'Күндөлүк иш процесси',
  'Select sacks, add a half-sack when needed, enter actual pieces, then complete.':'Каптарды тандап, керек болсо 0,5 кап кошуп, чыныгы даананы киргизип бүтүрүңүз.',
  'New production':'Жаңы өндүрүш','Today’s production':'Бүгүнкү өндүрүш','Batches':'Партиялар',
  'Material consumption':'Материал керектөөсү','Actual pieces':'Чыныгы даана',
  'Expected consumption':'Күтүлгөн керектөө','Actual':'Чыныгы','Expected':'Күтүлгөн',
  'Complete production':'Өндүрүштү бүтүрүү','Clear':'Тазалоо','No production saved today.':'Бүгүн өндүрүш сакталган жок.',
  'Current theoretical stock plus package-aware receiving.':'Учурдагы эсептик калдык жана таңгак боюнча кабыл алуу.',
  'Stock & inventory':'Кампа жана запастар','See balances and stock movements':'Калдык жана кыймылдар',
  'Review production and usage':'Өндүрүш жана керектөө','Manage staff and roles':'Кызматкерлерди жана ролдорду башкаруу',
  'Open the naan workflow':'Нан / лепёшка процессин ачуу','Open the sales workspace':'Сатуу жумуш ордун ачуу',
  'Edit the working recipe':'Жумушчу рецептти өзгөртүү','Sign out from this device':'Бул түзмөктөн чыгуу',
  'Everything else':'Калган бөлүмдөр','Keep the daily workflow focused. Less-used tools live here.':'Күндөлүк негизги иш жөнөкөй бойдон калат. Аз колдонулган куралдар ушул жерде.',
  'Admin access only.':'Администратор үчүн гана.','Panel reserved':'Панель резервде',
  'This panel is reserved for the exact workflow you will provide next.':'Бул бөлүм кийин сиз берген так иш процесси үчүн резервде турат.',
  'No active recipe found. Run the database seed SQL first.':'Активдүү рецепт табылган жок. Адегенде SQL аркылуу баштапкы маалыматты түзүңүз.',
  'Recipe saved as':'Рецепт сакталды:','Production saved.':'Өндүрүш сакталды.'
});


Object.assign(DICT.ru, {'sack':'мешок','sacks':'мешков','Sack count':'Количество мешков','sack count':'количество мешков'});
Object.assign(DICT.ky, {'sack':'кап','sacks':'кап','Sack count':'Каптын саны','sack count':'каптын саны'});


Object.assign(DICT.ru, {
  'Home':'Главная','More':'Ещё','Bakery control':'Управление пекарней',
  'Designed & built with care':'Создано с заботой'
});
Object.assign(DICT.ky, {
  'Home':'Башкы бет','More':'Дагы','Bakery control':'Наабайкананы башкаруу',
  'Designed & built with care':'Көңүл коюу менен жасалды'
});

Object.assign(DICT.ru, {'Show password':'Показать пароль','Hide password':'Скрыть пароль','People':'Персонал'});
Object.assign(DICT.ky, {'Show password':'Сырсөздү көрсөтүү','Hide password':'Сырсөздү жашыруу','People':'Кызматкерлер'});

Object.assign(DICT.ru, {
  'Bakery control':'Управление пекарней','Language':'Язык','Home':'Главная','More':'Ещё',
  'Everything else':'Остальные разделы','Keep the daily workflow focused. Less-used tools live here.':'Основной рабочий процесс остаётся простым. Редко используемые инструменты находятся здесь.',
  'Log out':'Выйти','Sign out from this device':'Выйти с этого устройства',
  'Daily workflow':'Ежедневный процесс','Select sacks, add a half-sack when needed, enter actual pieces, then complete.':'Выберите мешки, при необходимости добавьте 0,5 мешка, введите фактическое количество штук и завершите.',
  'New production':'Новое производство','Sack count':'Количество мешков','Total sacks':'Всего мешков','Material consumption':'Расход материалов',
  'A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.':'Полный мешок = 1,0. Кнопка +0,5 добавляет половину мешка: 6 + 0,5 = 6,5. Максимум — 9,5 мешка.',
  'Complete production':'Завершить производство','Clear':'Очистить','Today’s production':'Производство сегодня','Time':'Время',
  'Sacks':'Мешков','Pieces':'Штук','Recipe':'Рецепт','No production saved today.':'Сегодня производство ещё не сохранено.',
  'Batches':'Партии','1.0 sack':'1,0 мешок','0.5 sack':'0,5 мешка','Actual pieces':'Фактическое количество штук',
  'expected':'ожидается','Expected':'Ожидается','Actual':'Фактически','Current standard':'Текущий стандарт',
  'Working recipe per operational sack. Authorized production users can edit it.':'Рабочий рецепт на один операционный мешок. Уполномоченные производственные пользователи могут его изменять.',
  'Save as new recipe version':'Сохранить как новую версию рецепта','Packaging rules':'Правила упаковки',
  'Material':'Материал','Purchase package':'Упаковка закупки',
  'Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.':'Вода — ингредиент рецепта, но не складской материал. Соль: пачки 1 кг и 750 г. Дрожжи: пакеты 500 г и коробки по 20. Масло: коробки по 20 кг.',
  'Inventory':'Склад','Current theoretical stock plus package-aware receiving.':'Текущий расчётный запас с учётом упаковок при приёмке.',
  '+ Stock in':'+ Приход','Material details':'Детали материалов','Stock':'Остаток','Package options':'Варианты упаковки',
  'Receive stock':'Принять товар','Package':'Упаковка','Number of packages':'Количество упаковок',
  'Notes':'Примечание','Cancel':'Отмена','Add stock':'Добавить','Supplier / delivery note':'Поставщик / примечание к поставке',
  'The system will convert package quantity into the inventory base unit.':'Система автоматически переведёт количество упаковок в базовую единицу склада.',
  'Reports':'Отчёты','Operational summary from saved production.':'Операционный итог по сохранённому производству.',
  'All-time sacks':'Мешки за всё время','All-time pieces':'Штуки за всё время','Pieces / sack':'Штук / мешок',
  'Production history':'История производства','Date':'Дата','Worker':'Работник','No production yet.':'Производства ещё нет.',
  'Users':'Пользователи','People':'Персонал','Four role model. User creation can be managed in Supabase Auth + profiles.':'Четыре роли. Пользователи управляются через Supabase Auth и профили.',
  'User':'Пользователь','Role':'Роль','Access':'Доступ','Admin access only.':'Только для администратора.',
  'Panel is reserved and protected.':'Панель зарезервирована и защищена.','Panel ready. We will add the exact process after you provide it.':'Панель готова. Мы добавим точный процесс после того, как вы предоставите точный рабочий процесс.',
  'Save as new recipe version':'Сохранить как новую версию рецепта',
  'Unable to load your profile.':'Не удалось загрузить ваш профиль.','Invalid login credentials':'Неверный логин или пароль.',
  'Email is not confirmed':'Электронная почта не подтверждена.','Not authorized':'Нет прав для выполнения этого действия.',
  'Insufficient stock':'Недостаточно товара на складе.','Recipe version is not active':'Версия рецепта не активна.',
  'Something went wrong':'Что-то пошло не так.','Every batch needs a positive whole-number piece count.':'Для каждой партии нужно указать положительное целое количество штук.'
});
Object.assign(DICT.ky, {
  'Bakery control':'Наабайкананы башкаруу','Language':'Тил','Home':'Башкы бет','More':'Дагы',
  'Everything else':'Калган бөлүмдөр','Keep the daily workflow focused. Less-used tools live here.':'Негизги күнүмдүк иш жөнөкөй бойдон калат. Аз колдонулган куралдар ушул жерде.',
  'Log out':'Чыгуу','Sign out from this device':'Бул түзмөктөн чыгуу',
  'Daily workflow':'Күндөлүк иш процесси','Select sacks, add a half-sack when needed, enter actual pieces, then complete.':'Каптарды тандап, керек болсо 0,5 кап кошуп, чыныгы даананы киргизип бүтүрүңүз.',
  'New production':'Жаңы өндүрүш','Sack count':'Каптын саны','Total sacks':'Жалпы кап','Material consumption':'Материал керектөөсү',
  'A full sack = 1.0. The +0.5 button adds a half-sack, so 6 + 0.5 = 6.5. Maximum is 9.5 sacks.':'Толук кап = 1,0. +0,5 баскычы жарым кап кошот: 6 + 0,5 = 6,5. Максимум — 9,5 кап.',
  'Complete production':'Өндүрүштү бүтүрүү','Clear':'Тазалоо','Today’s production':'Бүгүнкү өндүрүш','Time':'Убакыт',
  'Sacks':'Кап','Pieces':'Даана','Recipe':'Рецепт','No production saved today.':'Бүгүн өндүрүш сакталган жок.',
  'Batches':'Партиялар','1.0 sack':'1,0 кап','0.5 sack':'0,5 кап','Actual pieces':'Чыныгы даана',
  'expected':'күтүлгөн','Expected':'Күтүлгөн','Actual':'Чыныгы','Current standard':'Учурдагы стандарт',
  'Working recipe per operational sack. Authorized production users can edit it.':'Бир иштик кап үчүн жумушчу рецепт. Ыйгарым укуктуу кызматкер өзгөртө алат.',
  'Save as new recipe version':'Жаңы рецепт версиясы катары сактоо','Packaging rules':'Таңгактоо эрежелери',
  'Material':'Материал','Purchase package':'Сатып алуу таңгагы',
  'Water is one material. Salt supports 1 kg and 750 g packets. Yeast supports 500 g packets and 20-packet boxes. Oil uses 20 kg cartons.':'Суу рецепттин ингредиенти, бирок кампа материалы эмес. Туз: 1 кг жана 750 г пакет. Ачыткы: 500 г пакет жана 20 пакеттик куту. Май: 20 кг куту.',
  'Inventory':'Кампа','Current theoretical stock plus package-aware receiving.':'Учурдагы эсептик калдык жана таңгак боюнча кабыл алуу.',
  '+ Stock in':'+ Кампага киргизүү','Material details':'Материалдардын маалыматы','Stock':'Калдык','Package options':'Таңгак варианттары',
  'Receive stock':'Товар кабыл алуу','Package':'Таңгак','Number of packages':'Таңгак саны',
  'Notes':'Эскертүү','Cancel':'Жокко чыгаруу','Add stock':'Кошуу','Supplier / delivery note':'Жеткирүүчү / жеткирүү эскертүүсү',
  'The system will convert package quantity into the inventory base unit.':'Система таңгак санын автоматтык түрдө негизги өлчөмгө которот.',
  'Reports':'Отчёттор','Operational summary from saved production.':'Сакталган өндүрүш боюнча оперативдүү жыйынтык.',
  'All-time sacks':'Бардык каптар','All-time pieces':'Бардык даана','Pieces / sack':'Даана / кап',
  'Production history':'Өндүрүш тарыхы','Date':'Дата','Worker':'Кызматкер','No production yet.':'Азырынча өндүрүш жок.',
  'Users':'Колдонуучулар','People':'Кызматкерлер','Four role model. User creation can be managed in Supabase Auth + profiles.':'Төрт роль. Колдонуучулар Supabase Auth жана профилдер аркылуу башкарылат.',
  'User':'Колдонуучу','Role':'Роль','Access':'Мүмкүнчүлүк','Admin access only.':'Администратор үчүн гана.',
  'Panel is reserved and protected.':'Панель резервде жана корголгон.','Panel ready. We will add the exact process after you provide it.':'Панель даяр. Так процессти сиз бергенден кийин кошобуз.',
  'Unable to load your profile.':'Профилди жүктөө мүмкүн болгон жок.','Invalid login credentials':'Логин же сырсөз туура эмес.',
  'Email is not confirmed':'Электрондук почта ырасталган эмес.','Not authorized':'Бул аракетке уруксат жок.',
  'Insufficient stock':'Кампада товар жетишсиз.','Recipe version is not active':'Рецепттин версиясы активдүү эмес.',
  'Something went wrong':'Ката кетти.','Every batch needs a positive whole-number piece count.':'Ар бир партия үчүн оң бүтүн даана санын көрсөтүңүз.'
});

export function normalizeLang(value){ return value && DICT[value] ? value : 'en'; }
export function getSavedLang(userId='guest'){ return normalizeLang(localStorage.getItem(`${LANG_KEY}_${userId}`) || localStorage.getItem(LANG_KEY) || 'en'); }
export function saveLang(userId, lang){ lang=normalizeLang(lang); localStorage.setItem(`${LANG_KEY}_${userId||'guest'}`,lang); localStorage.setItem(LANG_KEY,lang); return lang; }
export function languageOptions(selected){
  const l=normalizeLang(selected);
  const labels={
    en:{en:'English',ru:'Русский',ky:'Кыргызча'},
    ru:{en:'Английский',ru:'Русский',ky:'Кыргызский'},
    ky:{en:'Англисче',ru:'Орусча',ky:'Кыргызча'}
  }[l]||LANGUAGES;
  return Object.keys(LANGUAGES).map(code=>`<option value="${code}" ${code===l?'selected':''}>${labels[code]}</option>`).join('');
}
export function t(value, lang='en'){ const l=normalizeLang(lang); return DICT[l][value] || value; }

function replaceText(text, lang){
  let out=text;
  if(lang==='en') return out;
  const dict=DICT[lang];
  Object.keys(dict).sort((a,b)=>b.length-a.length).forEach(k=>{ if(out.includes(k)) out=out.split(k).join(dict[k]); });
  // Common dynamic phrases not suitable for an exact-key map.
  if(lang==='ru'){ out=out.replace(/\bSaved\s+(\d+(?:\.\d+)?)\s+mishok\.?/gi,'Сохранено $1 мишок.'); out=out.replace(/\b1\.0 mishok\b/g,'1,0 мишок').replace(/\b0\.5 mishok\b/g,'0,5 мишок'); out=out.replace(/\bmishok\b/gi,'мишок'); out=out.replace(/\bkg\b/g,'кг'); }
  if(lang==='ky'){ out=out.replace(/\bSaved\s+(\d+(?:\.\d+)?)\s+mishok\.?/gi,'$1 мишок сакталды.'); out=out.replace(/\b1\.0 mishok\b/g,'1,0 мишок').replace(/\b0\.5 mishok\b/g,'0,5 мишок'); out=out.replace(/\bmishok\b/gi,'мишок'); out=out.replace(/\bkg\b/g,'кг'); }
  return out;
}

export function applyTranslations(root=document, lang='en'){
  lang=normalizeLang(lang);
  if(lang==='en') return;
  const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes=[]; let n; while((n=walker.nextNode())) nodes.push(n);
  nodes.forEach(node=>{
    const parent=node.parentElement;
    if(parent && ['SCRIPT','STYLE'].includes(parent.tagName)) return;
    const translated=replaceText(node.nodeValue,lang); if(translated!==node.nodeValue) node.nodeValue=translated;
  });
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el=>{
    ['placeholder','title','aria-label'].forEach(attr=>{ if(el.hasAttribute(attr)){ const v=el.getAttribute(attr); const nv=replaceText(v,lang); if(nv!==v) el.setAttribute(attr,nv); } });
  });
}
