/**
 * data.js — Clínica Elcana
 * Conteúdo padrão do site.
 * Estes valores são usados apenas como FALLBACK caso o Firebase
 * não esteja disponível ou ainda não tenha sido configurado.
 * Após a primeira configuração pelo painel admin, os dados do
 * Firebase sempre terão prioridade.
 */

const ELCANA_DEFAULTS = {

  // Wallpapers pré-configurados (Unsplash — substitua por fotos reais da clínica)
  wallpaperPresets: [
    { label: "Opção 1 — Spa",       thumb: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=70&auto=format", full: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1600&q=80&auto=format" },
    { label: "Opção 2 — Facial",    thumb: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&q=70&auto=format", full: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1600&q=80&auto=format" },
    { label: "Opção 3 — Clínica",   thumb: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=400&q=70&auto=format", full: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1600&q=80&auto=format" },
    { label: "Opção 4 — Bem-estar", thumb: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=70&auto=format", full: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1600&q=80&auto=format" }
  ],

  // Dados salvos no Firestore (estrutura espelho)
  site: {
    wallpaper: {
      presetIndex: 0,
      customUrl: ""
    },
    texts: {
      heroTitle:     "A arte de cuidar de você.",
      heroSub:       "Cada detalhe importa. Do ambiente acolhedor ao atendimento atencioso, trabalhamos para realçar aquilo que já é belo em você.",
      aboutTitle:    "Aqui, cada detalhe importa.",
      aboutText:     "Do ambiente acolhedor ao atendimento atencioso, da escolha dos equipamentos mais modernos ao toque humano que respeita e valoriza sua individualidade. Trabalhamos com a mais alta tecnologia estética, mas sem jamais perder de vista o que nos move: a empatia, o acolhimento e o compromisso em realçar aquilo que já é belo em você.",
      contactPhrase: "Fale com a nossa equipe e descubra como podemos transformar sua beleza e bem-estar em uma experiência única."
    },
    contact: {
      address:  "Av. Nossa Sra. de Lourdes, 630 — Jardim das Américas, Curitiba — PR",
      phone:    "41999538779",
      instagram:"@clinicaelcana",
      wppText:  "Falar no WhatsApp"
    },
    procedures: [
      { name: "Harmonização Facial",        desc: "Procedimento que busca equilíbrio e harmonia entre as estruturas do rosto, utilizando técnicas minimamente invasivas para resultados naturais e elegantes." },
      { name: "Botox (Toxina Botulínica)",  desc: "Suaviza linhas de expressão e rugas dinâmicas, proporcionando aspecto mais jovem e natural, com resultado que dura em média de 4 a 6 meses." },
      { name: "Bioestimuladores de Colágeno", desc: "Estimulam a produção natural de colágeno da pele, melhorando progressivamente a textura, firmeza e elasticidade ao longo das semanas." },
      { name: "Ácido Hialurônico",          desc: "Preenchimento para volumizar, hidratar e suavizar regiões como lábios, olheiras, têmporas e maçãs do rosto." },
      { name: "Ultraformer MPT",            desc: "Ultrassom microfocado de alta intensidade para lifting não cirúrgico do rosto e corporal, sem tempo de recuperação." },
      { name: "Harmonização Glútea",        desc: "Procedimento para modelar, definir e volumizar a região glútea com técnicas seguras e minimamente invasivas." }
    ]
  }
};
