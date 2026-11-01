// Mochiboard internationalization (i18n)
// Lightweight vanilla translation module supporting dynamic language switching.
(() => {
  const STORAGE_KEY = 'mochiboard:lang';

  const translations = {
    'en': {
      // General / Common
      'common.close': 'Close',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.rename': 'Rename',
      'common.duplicate': 'Duplicate',
      'common.copy': 'Copy',
      'common.cut': 'Cut',
      'common.paste': 'Paste',
      'common.reset': 'Reset',
      'common.done': 'Done',
      'common.undo': 'Undo',
      'common.redo': 'Redo',
      'common.export': 'Export',
      'common.minimize': 'Minimize',

      // Sidebar
      'side.all_projects': 'All projects',
      'side.everything': 'Everything',
      'side.new_board': '+ Board',
      'side.new_folder': '+ Folder',
      'side.new_project': '+ Project',
      'side.layers': 'Layers',
      'side.board_colors': 'Board colors',
      'side.learn': 'Learn',
      'side.dictionary': 'Dictionary',
      'side.dictionary_desc': '80 UX terms, in plain words',
      'side.principles': 'Principles',
      'side.principles_desc': 'Nielsen, Gestalt, Rams, Laws of UX…',
      'side.music_title': "{name}'s music",
      'side.music_volume': 'Volume',
      'side.music_play': 'Play',
      'side.dressup_title': 'Dress up {name}',
      'side.get_app': 'Web demo • Get the app',

      // Settings modal
      'set.title': 'Settings',
      'set.tab_general': 'General',
      'set.tab_mochi': 'Mochi',
      'set.tab_helpers': 'Helpers',
      'set.tab_board': 'Board',
      'set.tab_toolbar': 'Toolbar',
      'set.tab_widgets': 'Widgets',
      'set.tab_about': 'About',

      'set.look': 'Look',
      'set.theme': 'Theme',
      'set.theme_desc': 'Light, dark, or whatever your system is using',
      'set.theme_light': 'Light',
      'set.theme_dark': 'Dark',
      'set.theme_system': 'Match system',

      'set.language': 'Language',
      'set.language_desc': 'Interface language',

      'set.cursor': 'Your cursor',
      'set.cursor_color': 'Color',
      'set.cursor_fancy': 'Playful cursor',
      'set.cursor_fancy_desc': 'The pointer turns into a little hand over cards',

      'set.mochi_section': 'Mochi',
      'set.mochi_name': 'Her name',
      'set.mochi_name_desc': 'Call her whatever you like. She answers to it everywhere.',
      'set.mochi_personality': 'Personality',
      'set.mochi_personality_desc': 'Lively, calm, or completely quiet',
      'set.mochi_lively': 'Lively',
      'set.mochi_calm': 'Calm',
      'set.mochi_calmest': 'Quiet',
      'set.mochi_show': 'Show Mochi',
      'set.mochi_show_desc': 'A little goo who lives on your board and thinks with Claude',

      'set.helpers_title': "Mochi's helpers",
      'set.helpers_claude': 'Claude Code',
      'set.helpers_usage': 'Claude usage',
      'set.helpers_whisper': 'Voice memo writing',
      'set.helpers_whisper_desc': 'Transcribe voice memos on this computer with Whisper',

      'set.board_section': 'The board',
      'set.board_colors': 'Colors',
      'set.board_colors_desc': 'The background, dots, panels and accent. Right-click any board to give just that board its own background.',
      'set.board_reset_colors': 'Reset colors',
      'set.board_grid': 'Dot grid',
      'set.board_grid_desc': 'The soft dots behind your cards',
      'set.board_grid_shape': 'Grid shape',
      'set.board_grid_shape_desc': 'Dots, or something a little cuter',
      'set.board_note_color': 'New note color',
      'set.board_note_color_desc': 'What a fresh note starts as',
      'set.board_dbl_note': 'Double-click to add a note',
      'set.board_dbl_note_desc': 'Double-click empty board for a new note. Off if stray notes keep popping up',
      'set.board_snap': 'Snap to the dots',
      'set.board_snap_desc': 'Cards line up with the grid when you drop them',
      'set.board_tilt': 'Loose, tilted cards',
      'set.board_tilt_desc': 'Off makes every card sit perfectly straight',
      'set.board_motion': 'Moving stamps and wiggles',
      'set.board_motion_desc': 'Turn off for a calmer board',
      'set.board_shortcuts': 'Shortcut hints',
      'set.board_shortcuts_desc': 'The little key list in the bottom corner',

      'set.pictures': 'Pictures',
      'set.pictures_border': 'Picture borders',
      'set.pictures_border_desc': 'New pictures get a little white border. Each picture’s bar can switch its own on or off.',
      'set.pictures_pull_colors': 'Pull colors button',
      'set.pictures_pull_colors_desc': 'The little chip on pictures for making a palette from a photo. Off hides it.',
      'set.pictures_radius': 'Rounded corners on new pictures',
      'set.pictures_radius_desc': 'Pictures you pull in start with soft corners. Off starts them square.',
      'set.pictures_hints': 'Image hints on board',
      'set.pictures_hints_desc': 'Little tips when you hover a picture or placeholder. Off once you know your way around.',

      'set.your_boards': 'Your boards',
      'set.saved_computer': 'Saved on this computer',
      'set.saved_computer_desc': 'Your boards never leave your computer',
      'set.show_in_folder': 'Show in folder',

      'set.toolbar_size': 'Icon size',
      'set.toolbar_size_desc': 'How big the tools at the bottom are. If they don’t all fit on your screen, the extras tuck into a menu at the end.',
      'set.toolbar_size_s': 'Small',
      'set.toolbar_size_m': 'Medium',
      'set.toolbar_size_l': 'Large',
      'set.toolbar_tools': 'Your tools',
      'set.toolbar_tools_desc': 'Switch tools on or off, and drag to change their order. Shortcuts still work for tools you hide.',

      'set.devices': 'Camera & microphone',
      'set.camera': 'Camera',
      'set.camera_desc': 'For video cards',
      'set.microphone': 'Microphone',
      'set.microphone_desc': 'For voice memos and videos',

      'set.about_title': 'Mochiboard',
      'set.about_desc': 'A planning canvas for designers, with Mochi as your helper. Free and open source (MIT).',
      'set.update_auto': 'Update automatically',
      'set.update_auto_desc': 'New versions install quietly when you quit Mochiboard. Your boards never change.',
      'set.tour_prompt': 'New here, or need a refresher?',
      'set.tour_prompt_desc': 'Mochi shows you around in about a minute',
      'set.tour_btn': 'Take the tour ✨',
      'set.setup_btn': 'Redo setup',
      'set.feedback_btn': 'Send feedback 💬',

      // Toolbar tools
      'tool.pointer': 'Select · V',
      'tool.note': 'Note · N',
      'tool.doc': 'Doc · D',
      'tool.checklist': 'Checklist · C',
      'tool.title': 'Big title · T',
      'tool.collection': 'Collection · G',
      'tool.canvas': 'Canvas (a board inside this one)',
      'tool.link': 'Link · L',
      'tool.image': 'Image · I',
      'tool.voice': 'Voice memo · A',
      'tool.video': 'Video · ⇧V',
      'tool.swatch': 'Color',
      'tool.shapes': 'Shapes · S',
      'tool.stamps': 'Stamps · E',
      'tool.templates': 'Templates',
      'tool.draw': 'Draw · P',
      'tool.wireframe': 'Wireframe · R / X',
      'tool.connect': 'Connect · W',
      'tool.mochi': 'Ask Mochi',

      // Context menus & common strings
      'Group  ⌘G': 'Group  ⌘G',
      'Ungroup  ⇧⌘G': 'Ungroup  ⇧⌘G',
      'Create section  ⌥⌘G': 'Create section  ⌥⌘G',
      'Rename section': 'Rename section',
      'Remove section': 'Remove section',
      'Reset tilt': 'Reset tilt',
      'Reset tilts': 'Reset tilts',
      'Export as image': 'Export as image',
      'Export as PDF': 'Export as PDF',
      'Export board as image': 'Export board as image',
      'Export board as PDF': 'Export board as PDF',
      'Save each as its own image': 'Save each as its own image',
      'Duplicate': 'Duplicate',
      'Delete': 'Delete',
      'Background color…': 'Background color…',
      'Use the default background': 'Use the default background',
      'Customize toolbar…': 'Customize toolbar…',
      'Rename': 'Rename',
      'Move to folder…': 'Move to folder…',
      'Duplicate board': 'Duplicate board',
      'Delete board': 'Delete board',
      'Delete folder': 'Delete folder',

      // Mochi chat
      'mochi.ask_ph': 'Ask {name}… "group these by theme"',
      'mochi.thinking': '{name} is thinking…',
      'mochi.writing': '{name} is writing it out…'
    },

    'pt-BR': {
      // General / Common
      'common.close': 'Fechar',
      'common.save': 'Salvar',
      'common.cancel': 'Cancelar',
      'common.delete': 'Excluir',
      'common.rename': 'Renomear',
      'common.duplicate': 'Duplicar',
      'common.copy': 'Copiar',
      'common.cut': 'Recortar',
      'common.paste': 'Colar',
      'common.reset': 'Redefinir',
      'common.done': 'Concluído',
      'common.undo': 'Desfazer',
      'common.redo': 'Refazer',
      'common.export': 'Exportar',
      'common.minimize': 'Minimizar',

      // Sidebar
      'side.all_projects': 'Todos os projetos',
      'side.everything': 'Tudo',
      'side.new_board': '+ Quadro',
      'side.new_folder': '+ Pasta',
      'side.new_project': '+ Projeto',
      'side.layers': 'Camadas',
      'side.board_colors': 'Cores do quadro',
      'side.learn': 'Aprender',
      'side.dictionary': 'Dicionário',
      'side.dictionary_desc': '80 termos de UX explicados de forma simples',
      'side.principles': 'Princípios',
      'side.principles_desc': 'Nielsen, Gestalt, Rams, Leis de UX…',
      'side.music_title': 'Músicas do {name}',
      'side.music_volume': 'Volume',
      'side.music_play': 'Tocar',
      'side.dressup_title': 'Vestir o {name}',
      'side.get_app': 'Demo Web • Baixar o aplicativo',

      // Settings modal
      'set.title': 'Configurações',
      'set.tab_general': 'Geral',
      'set.tab_mochi': 'Mochi',
      'set.tab_helpers': 'Assistentes',
      'set.tab_board': 'Quadro',
      'set.tab_toolbar': 'Ferramentas',
      'set.tab_widgets': 'Painéis',
      'set.tab_about': 'Sobre',

      'set.look': 'Aparência',
      'set.theme': 'Tema',
      'set.theme_desc': 'Claro, escuro ou acompanhar o sistema operacional',
      'set.theme_light': 'Claro',
      'set.theme_dark': 'Escuro',
      'set.theme_system': 'Acompanhar sistema',

      'set.language': 'Idioma',
      'set.language_desc': 'Idioma da interface',

      'set.cursor': 'Seu cursor',
      'set.cursor_color': 'Cor',
      'set.cursor_fancy': 'Cursor animado',
      'set.cursor_fancy_desc': 'O ponteiro vira uma mãozinha sobre os cartões',

      'set.mochi_section': 'Mochi',
      'set.mochi_name': 'Nome do assistente',
      'set.mochi_name_desc': 'Chame como preferir. Ele responderá por esse nome.',
      'set.mochi_personality': 'Personalidade',
      'set.mochi_personality_desc': 'Animado, calmo ou silencioso',
      'set.mochi_lively': 'Animado',
      'set.mochi_calm': 'Calmo',
      'set.mochi_calmest': 'Silencioso',
      'set.mochi_show': 'Exibir Mochi',
      'set.mochi_show_desc': 'Um pequeno mascote no seu quadro que pensa com o Claude',

      'set.helpers_title': 'Assistentes do Mochi',
      'set.helpers_claude': 'Claude Code',
      'set.helpers_usage': 'Uso do Claude',
      'set.helpers_whisper': 'Transcrição de voz',
      'set.helpers_whisper_desc': 'Transcreve áudios localmente no computador via Whisper',

      'set.board_section': 'O Quadro',
      'set.board_colors': 'Cores',
      'set.board_colors_desc': 'Fundo, pontos da grade, painéis e destaque. Clique com botão direito para personalizar.',
      'set.board_reset_colors': 'Redefinir cores',
      'set.board_grid': 'Grade de pontos',
      'set.board_grid_desc': 'Pontos suaves no fundo dos seus cartões',
      'set.board_grid_shape': 'Formato da grade',
      'set.board_grid_shape_desc': 'Pontos tradicionais ou formatos fofos',
      'set.board_note_color': 'Cor da nova nota',
      'set.board_note_color_desc': 'Cor inicial padrão para novos post-its',
      'set.board_dbl_note': 'Clique duplo para nova nota',
      'set.board_dbl_note_desc': 'Dois cliques na área vazia criam uma nota',
      'set.board_snap': 'Alinhar aos pontos',
      'set.board_snap_desc': 'Cartões se alinham automaticamente com a grade ao soltar',
      'set.board_tilt': 'Cartões inclinados',
      'set.board_tilt_desc': 'Desative para manter todos os cartões perfeitamente retos',
      'set.board_motion': 'Adesivos animados',
      'set.board_motion_desc': 'Desative para ter um quadro mais calmo e estático',
      'set.board_shortcuts': 'Dicas de atalhos',
      'set.board_shortcuts_desc': 'Lista rápida de teclas no canto inferior',

      'set.pictures': 'Imagens',
      'set.pictures_border': 'Borda nas imagens',
      'set.pictures_border_desc': 'Novas imagens recebem uma borda branca suave',
      'set.pictures_pull_colors': 'Botão extrair cores',
      'set.pictures_pull_colors_desc': 'Ícone para gerar uma paleta de cores a partir da foto',
      'set.pictures_radius': 'Bordas arredondadas',
      'set.pictures_radius_desc': 'Imagens importadas iniciam com cantos suaves',
      'set.pictures_hints': 'Dicas ao passar o mouse',
      'set.pictures_hints_desc': 'Dicas úteis sobre imagens e placeholders',

      'set.your_boards': 'Seus quadros',
      'set.saved_computer': 'Salvos neste computador',
      'set.saved_computer_desc': 'Seus dados e quadros nunca saem do seu computador',
      'set.show_in_folder': 'Abrir pasta',

      'set.toolbar_size': 'Tamanho dos ícones',
      'set.toolbar_size_desc': 'Tamanho das ferramentas no rodapé',
      'set.toolbar_size_s': 'Pequeno',
      'set.toolbar_size_m': 'Médio',
      'set.toolbar_size_l': 'Grande',
      'set.toolbar_tools': 'Suas ferramentas',
      'set.toolbar_tools_desc': 'Ative/desative e arraste para reordenar a barra de ferramentas',

      'set.devices': 'Câmera e microfone',
      'set.camera': 'Câmera',
      'set.camera_desc': 'Para cartões de vídeo',
      'set.microphone': 'Microfone',
      'set.microphone_desc': 'Para notas de voz e vídeos',

      'set.about_title': 'Mochiboard',
      'set.about_desc': 'Um quadro de planejamento aconchegante para designers, com o Mochi como assistente. Código livre e aberto (MIT).',
      'set.update_auto': 'Atualizar automaticamente',
      'set.update_auto_desc': 'Instala novas versões em segundo plano ao fechar o app',
      'set.tour_prompt': 'Novo por aqui ou quer relembrar?',
      'set.tour_prompt_desc': 'O Mochi te mostra as funções em cerca de um minuto',
      'set.tour_btn': 'Fazer o tour ✨',
      'set.setup_btn': 'Refazer introdução',
      'set.feedback_btn': 'Enviar feedback 💬',

      // Toolbar tools
      'tool.pointer': 'Selecionar · V',
      'tool.note': 'Nota · N',
      'tool.doc': 'Documento · D',
      'tool.checklist': 'Lista · C',
      'tool.title': 'Título · T',
      'tool.collection': 'Coleção · G',
      'tool.canvas': 'Canvas (um quadro dentro deste)',
      'tool.link': 'Link · L',
      'tool.image': 'Imagem · I',
      'tool.voice': 'Áudio · A',
      'tool.video': 'Vídeo · ⇧V',
      'tool.swatch': 'Cor',
      'tool.shapes': 'Formas · S',
      'tool.stamps': 'Adesivos · E',
      'tool.templates': 'Modelos',
      'tool.draw': 'Desenho · P',
      'tool.wireframe': 'Wireframe · R / X',
      'tool.connect': 'Conector · W',
      'tool.mochi': 'Perguntar ao Mochi',

      // Context menus & common strings
      'Group  ⌘G': 'Agrupar  ⌘G',
      'Ungroup  ⇧⌘G': 'Desagrupar  ⇧⌘G',
      'Create section  ⌥⌘G': 'Criar seção  ⌥⌘G',
      'Rename section': 'Renomear seção',
      'Remove section': 'Remover seção',
      'Reset tilt': 'Remover inclinação',
      'Reset tilts': 'Remover inclinações',
      'Export as image': 'Exportar como imagem',
      'Export as PDF': 'Exportar como PDF',
      'Export board as image': 'Exportar quadro como imagem',
      'Export board as PDF': 'Exportar quadro como PDF',
      'Save each as its own image': 'Salvar cada imagem separada',
      'Duplicate': 'Duplicar',
      'Delete': 'Excluir',
      'Background color…': 'Cor de fundo…',
      'Use the default background': 'Usar fundo padrão',
      'Customize toolbar…': 'Personalizar barra de ferramentas…',
      'Rename': 'Renomear',
      'Move to folder…': 'Mover para pasta…',
      'Duplicate board': 'Duplicar quadro',
      'Delete board': 'Excluir quadro',
      'Delete folder': 'Excluir pasta',

      // Mochi chat
      'mochi.ask_ph': 'Pergunte ao {name}… "organize isso por tema"',
      'mochi.thinking': '{name} está pensando…',
      'mochi.writing': '{name} está transcrevendo…'
    },

    'es': {
      // General / Common
      'common.close': 'Cerrar',
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.delete': 'Eliminar',
      'common.rename': 'Renombrar',
      'common.duplicate': 'Duplicar',
      'common.copy': 'Copiar',
      'common.cut': 'Cortar',
      'common.paste': 'Pegar',
      'common.reset': 'Restablecer',
      'common.done': 'Listo',
      'common.undo': 'Deshacer',
      'common.redo': 'Rehacer',
      'common.export': 'Exportar',
      'common.minimize': 'Minimizar',

      // Sidebar
      'side.all_projects': 'Todos los proyectos',
      'side.everything': 'Todo',
      'side.new_board': '+ Tablero',
      'side.new_folder': '+ Carpeta',
      'side.new_project': '+ Proyecto',
      'side.layers': 'Capas',
      'side.board_colors': 'Colores del tablero',
      'side.learn': 'Aprender',
      'side.dictionary': 'Diccionario',
      'side.dictionary_desc': '80 términos de UX explicados de forma simple',
      'side.principles': 'Principios',
      'side.principles_desc': 'Nielsen, Gestalt, Rams, Leyes de UX…',
      'side.music_title': 'Música de {name}',
      'side.music_volume': 'Volumen',
      'side.music_play': 'Reproducir',
      'side.dressup_title': 'Vestir a {name}',
      'side.get_app': 'Demo Web • Descargar la app',

      // Settings modal
      'set.title': 'Ajustes',
      'set.tab_general': 'General',
      'set.tab_mochi': 'Mochi',
      'set.tab_helpers': 'Asistentes',
      'set.tab_board': 'Tablero',
      'set.tab_toolbar': 'Herramientas',
      'set.tab_widgets': 'Paneles',
      'set.tab_about': 'Acerca de',

      'set.look': 'Apariencia',
      'set.theme': 'Tema',
      'set.theme_desc': 'Claro, oscuro o según el sistema operativo',
      'set.theme_light': 'Claro',
      'set.theme_dark': 'Oscuro',
      'set.theme_system': 'Seguir el sistema',

      'set.language': 'Idioma',
      'set.language_desc': 'Idioma de la interfaz',

      'set.cursor': 'Tu cursor',
      'set.cursor_color': 'Color',
      'set.cursor_fancy': 'Cursor animado',
      'set.cursor_fancy_desc': 'El puntero se convierte en una manita sobre las tarjetas',

      'set.mochi_section': 'Mochi',
      'set.mochi_name': 'Su nombre',
      'set.mochi_name_desc': 'Llámala como prefieras. Responderá por ese nombre.',
      'set.mochi_personality': 'Personalidad',
      'set.mochi_personality_desc': 'Animada, tranquila o silenciosa',
      'set.mochi_lively': 'Animada',
      'set.mochi_calm': 'Tranquila',
      'set.mochi_calmest': 'Silenciosa',
      'set.mochi_show': 'Mostrar a Mochi',
      'set.mochi_show_desc': 'Una pequeña criatura en tu tablero que piensa con Claude',

      'set.helpers_title': 'Asistentes de Mochi',
      'set.helpers_claude': 'Claude Code',
      'set.helpers_usage': 'Uso de Claude',
      'set.helpers_whisper': 'Transcripción de notas de voz',
      'set.helpers_whisper_desc': 'Transcribe audios localmente en tu ordenador con Whisper',

      'set.board_section': 'El Tablero',
      'set.board_colors': 'Colores',
      'set.board_colors_desc': 'Fondo, puntos de cuadrícula, paneles y acento. Clic derecho en cualquier tablero para personalizarlo.',
      'set.board_reset_colors': 'Restablecer colores',
      'set.board_grid': 'Cuadrícula de puntos',
      'set.board_grid_desc': 'Puntos suaves detrás de tus tarjetas',
      'set.board_grid_shape': 'Forma de la cuadrícula',
      'set.board_grid_shape_desc': 'Puntos o formas más tiernas',
      'set.board_note_color': 'Color de nota nueva',
      'set.board_note_color_desc': 'Color inicial por defecto para nuevas notas',
      'set.board_dbl_note': 'Doble clic para añadir nota',
      'set.board_dbl_note_desc': 'Doble clic en un área vacía para crear una nota',
      'set.board_snap': 'Alinear a los puntos',
      'set.board_snap_desc': 'Las tarjetas se alinean con la cuadrícula al soltarlas',
      'set.board_tilt': 'Tarjetas inclinadas',
      'set.board_tilt_desc': 'Desactívalo para que todas las tarjetas queden perfectamente rectas',
      'set.board_motion': 'Pegatinas con movimiento',
      'set.board_motion_desc': 'Desactívalo para un tablero más tranquilo y estático',
      'set.board_shortcuts': 'Atajos de teclado',
      'set.board_shortcuts_desc': 'Lista rápida de teclas en la esquina inferior',

      'set.pictures': 'Imágenes',
      'set.pictures_border': 'Bordes en imágenes',
      'set.pictures_border_desc': 'Las nuevas imágenes tienen un borde blanco suave',
      'set.pictures_pull_colors': 'Botón extraer colores',
      'set.pictures_pull_colors_desc': 'Ícono para crear una paleta a partir de la foto',
      'set.pictures_radius': 'Esquinas redondeadas',
      'set.pictures_radius_desc': 'Las imágenes que importas inician con esquinas suaves',
      'set.pictures_hints': 'Consejos al pasar el ratón',
      'set.pictures_hints_desc': 'Consejos útiles sobre imágenes y marcadores de posición',

      'set.your_boards': 'Tus tableros',
      'set.saved_computer': 'Guardados en este ordenador',
      'set.saved_computer_desc': 'Tus tableros nunca salen de tu ordenador',
      'set.show_in_folder': 'Mostrar en carpeta',

      'set.toolbar_size': 'Tamaño de íconos',
      'set.toolbar_size_desc': 'Tamaño de las herramientas en la barra inferior',
      'set.toolbar_size_s': 'Pequeño',
      'set.toolbar_size_m': 'Mediano',
      'set.toolbar_size_l': 'Grande',
      'set.toolbar_tools': 'Tus herramientas',
      'set.toolbar_tools_desc': 'Activa o desactiva y arrastra para reordenar la barra de herramientas',

      'set.devices': 'Cámara y micrófono',
      'set.camera': 'Cámara',
      'set.camera_desc': 'Para tarjetas de video',
      'set.microphone': 'Micrófono',
      'set.microphone_desc': 'Para notas de voz y videos',

      'set.about_title': 'Mochiboard',
      'set.about_desc': 'Un tablero de planificación para diseñadores, con Mochi como asistente. Gratuito y de código abierto (MIT).',
      'set.update_auto': 'Actualizar automáticamente',
      'set.update_auto_desc': 'Instala nuevas versiones en segundo plano al cerrar la app',
      'set.tour_prompt': '¿Nuevo por aquí o quieres recordar cómo funciona?',
      'set.tour_prompt_desc': 'Mochi te muestra el recorrido en un minuto',
      'set.tour_btn': 'Hacer el tour ✨',
      'set.setup_btn': 'Reiniciar configuración inicial',
      'set.feedback_btn': 'Enviar comentarios 💬',

      // Toolbar tools
      'tool.pointer': 'Seleccionar · V',
      'tool.note': 'Nota · N',
      'tool.doc': 'Documento · D',
      'tool.checklist': 'Lista · C',
      'tool.title': 'Título grande · T',
      'tool.collection': 'Colección · G',
      'tool.canvas': 'Canvas (un tablero dentro de este)',
      'tool.link': 'Enlace · L',
      'tool.image': 'Imagen · I',
      'tool.voice': 'Nota de voz · A',
      'tool.video': 'Video · ⇧V',
      'tool.swatch': 'Color',
      'tool.shapes': 'Formas · S',
      'tool.stamps': 'Pegatinas · E',
      'tool.templates': 'Plantillas',
      'tool.draw': 'Dibujar · P',
      'tool.wireframe': 'Wireframe · R / X',
      'tool.connect': 'Conectar · W',
      'tool.mochi': 'Preguntar a Mochi',

      // Context menus & common strings
      'Group  ⌘G': 'Agrupar  ⌘G',
      'Ungroup  ⇧⌘G': 'Desagrupar  ⇧⌘G',
      'Create section  ⌥⌘G': 'Crear sección  ⌥⌘G',
      'Rename section': 'Renombrar sección',
      'Remove section': 'Eliminar sección',
      'Reset tilt': 'Quitar inclinación',
      'Reset tilts': 'Quitar inclinaciones',
      'Export as image': 'Exportar como imagen',
      'Export as PDF': 'Exportar como PDF',
      'Export board as image': 'Exportar tablero como imagen',
      'Export board as PDF': 'Exportar tablero como PDF',
      'Save each as its own image': 'Guardar cada una por separado',
      'Duplicate': 'Duplicar',
      'Delete': 'Eliminar',
      'Background color…': 'Color de fondo…',
      'Use the default background': 'Usar fondo predeterminado',
      'Customize toolbar…': 'Personalizar barra de herramientas…',
      'Rename': 'Renombrar',
      'Move to folder…': 'Mover a carpeta…',
      'Duplicate board': 'Duplicar tablero',
      'Delete board': 'Eliminar tablero',
      'Delete folder': 'Eliminar carpeta',

      // Mochi chat
      'mochi.ask_ph': 'Pregúntale a {name}… "agrupa esto por tema"',
      'mochi.thinking': '{name} está pensando…',
      'mochi.writing': '{name} está transcribiendo…'
    }
  };

  // Detect preferred language: localStorage > navigator.language > 'en'
  function detectLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && translations[stored]) return stored;
    } catch (e) {}

    const browser = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (browser.startsWith('pt')) return 'pt-BR';
    if (browser.startsWith('es')) return 'es';
    return 'en';
  }

  let currentLang = detectLanguage();

  function t(key, fallback = '', vars = {}) {
    if (!key) return '';
    const dict = translations[currentLang] || translations['en'];
    let str = (dict && dict[key]) || (translations['en'] && translations['en'][key]) || fallback || key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return str;
  }

  function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    document.documentElement.lang = lang;
    applyI18n();
    window.dispatchEvent(new CustomEvent('mochiboard:languagechange', { detail: { lang } }));
  }

  function getLanguage() {
    return currentLang;
  }

  function applyI18n(root = document) {
    // text elements
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const translated = t(key, el.textContent);
      if (translated) el.textContent = translated;
    });

    // html content elements (for spans/strongs inside)
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.dataset.i18nHtml;
      const translated = t(key, el.innerHTML);
      if (translated) el.innerHTML = translated;
    });

    // titles
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      const translated = t(key, el.title);
      if (translated) el.title = translated;
    });

    // tooltips
    root.querySelectorAll('[data-i18n-tip]').forEach(el => {
      const key = el.dataset.i18nTip;
      const translated = t(key, el.dataset.tip);
      if (translated) el.dataset.tip = translated;
    });

    // aria-label
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.dataset.i18nAria;
      const translated = t(key, el.getAttribute('aria-label'));
      if (translated) el.setAttribute('aria-label', translated);
    });

    // placeholders
    root.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.dataset.i18nPh;
      const translated = t(key, el.placeholder);
      if (translated) el.placeholder = translated;
    });
  }

  window.I18N = {
    t,
    getLanguage,
    setLanguage,
    applyI18n,
    translations,
  };
  window.t = t;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyI18n());
  } else {
    setTimeout(applyI18n, 0);
  }
})();
