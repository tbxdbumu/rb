window.RB_DATA = (function () {
  'use strict';
  return {
    products: [
      {
        id: 'risebunny-bot', icon: 'fa-brands fa-discord', pIcon: 'fa-brands fa-discord',
        platform: 'Discord', status: 'active', order: 0, name: 'RiseBunny Bot',
        color: '#7c3aed', image: '', download: 'https://top.gg/bot/1540401487581020252',
        invite: 'https://discord.com/api/oauth2/authorize?client_id=1540401487581020252&permissions=8&scope=bot%20applications.commands',
        desc: {
          en: 'Our multi-purpose Discord bot, live on top.gg: AI registration, subscriber roles, economy, moderation and automated raid protection — updated non-stop. Live the Future Today!',
          tr: "top.gg'de yayında olan çok amaçlı Discord botumuz: Yapay zeka kayıt, abone rol sistemi, ekonomi, moderasyon ve otomatik koruma — sürekli güncel. Geleceği Bugünden Yaşa!"
        },
        features: {
          en: ['AI-powered registration', 'Subscriber role system', 'Economy & fun commands', 'Automated protection'],
          tr: ['Yapay zeka destekli kayıt', 'Abone rol sistemi', 'Ekonomi ve eğlence komutları', 'Otomatik koruma sistemleri']
        }
      },
      {
        id: 'risebunny-client', icon: 'fa-solid fa-cube', pIcon: 'fa-solid fa-cube',
        platform: 'Minecraft', status: 'dev', order: 1, name: 'RiseBunnyClient',
        color: '#06b6d4', image: '', download: '',
        desc: {
          en: 'Our signature Minecraft client: deep customization, smooth experience and RiseBunny polish in every pixel.',
          tr: 'İmza Minecraft istemcimiz: derin özelleştirme, akıcı deneyim ve her pikselde RiseBunny cilası.'
        },
        features: { en: ['Performance-first', 'Deep customization'], tr: ['Performans odaklı', 'Derin özelleştirme'] }
      },
      {
        id: 'rubidium-client', icon: 'fa-solid fa-ghost', pIcon: 'fa-solid fa-ghost',
        platform: 'Minecraft', status: 'dev', order: 2, name: 'Rubidium V4',
        color: '#10b981', image: 'images/image.webp', download: '',
        desc: {
          en: 'A ghost client for closet players: legit-looking combat modules, in-game ClickGUI and ready configs — Vape V4 and Rise class, free.',
          tr: 'Closet oyuncular için ghost client: legit görünen combat modülleri, oyun içi ClickGUI ve hazır configler — Vape V4 ve Rise ayarında, ücretsiz.'
        },
        features: { en: ['Ghost-focused modules', 'In-game ClickGUI'], tr: ['Ghost odaklı modüller', 'Oyun içi ClickGUI'] }
      },
      {
        id: 'risebrawl-v29', icon: 'fa-solid fa-star', pIcon: 'fa-solid fa-star',
        platform: 'Brawl Stars', status: 'project', order: 3, name: 'RiseBrawl V29',
        color: '#f59e0b', image: '', download: '',
        desc: {
          en: 'A Brawl Stars V29 playground project: custom vibes, unique experiences, pure nostalgia.',
          tr: 'Brawl Stars V29 oyun alanı projemiz: özel havalar, benzersiz deneyimler, saf nostalji.'
        },
        features: { en: ['Unique experience'], tr: ['Benzersiz deneyim'] }
      }
    ],
    faqs: [
      {
        id: 'f1', order: 0,
        q: { en: 'What exactly is RiseBunny?', tr: 'RiseBunny tam olarak nedir?' },
        a: {
          en: 'RiseBunny is An indie software crew under RiseBunny Software, constantly growing community that involved in many projects.',
          tr: 'RiseBunny Software çatısında bir indie yazılım ekibidir, Bir Sürü Projede Var Olan Ve Durmadan Büyüyen Bir Topluluktur.'
        }
      },
      {
        id: 'f2', order: 1,
        q: { en: 'Is everything really free?', tr: 'Her şey gerçekten ücretsiz mi?' },
        a: {
          en: 'Yes. Every RiseBunny project is free and will stay free, Supporting Us Optional.',
          tr: 'Evet. Tüm RiseBunny projeleri ücretsizdir ve ücretsiz kalacaktır. Destek opsiyoneldir.'
        }
      },
      {
        id: 'f3', order: 2,
        q: { en: 'Where do updates drop first?', tr: 'Güncellemeler ilk nerede yayınlanır?' },
        a: {
          en: 'You Can Check Our Discord, Tiktok, Telegram And Changelogs On Website for updates',
          tr: 'Güncellemeler için Discord, Tiktok, Telegram Ve Web Sitemizdeki Sürüm Notlarına Bakabilirsiniz'
        }
      }
    ],
    features: [
      {
        id: 'v1', order: 0, icon: 'fa-solid fa-infinity', color: '#7c3aed',
        title: { en: 'Non-Stop Shipping', tr: 'Durmadan Yayınlıyoruz' },
        desc: { en: 'Updates Land Very often. RiseBunny doesnt sleep, and neither do we', tr: 'Güncellemeler Çok Sık Yayınlanır, RiseBunny uyumaz, biz de.' }
      },
      {
        id: 'v2', order: 1, icon: 'fa-solid fa-shield-halved', color: '#10b981',
        title: { en: 'Raid-Proof by Design', tr: 'Raidlere karşı Korumalı Tasarım' },
        desc: { en: 'Protection systems born from real Discord raids and real lag spikes.', tr: 'Gerçek Discord raidlerinden ve gerçek lag anlarından doğan koruma sistemleri.' }
      },
      {
        id: 'v3', order: 2, icon: 'fa-solid fa-users', color: '#06b6d4',
        title: { en: 'Community-First', tr: 'Topluluk Öncelik' },
        desc: { en: 'Community Opinions Are #1 For Our Changes, We Build For You — you build this with us.', tr: 'Topluluk Fikirleri Bizim #1 Önceliğimizdir, Sizin İçin İnşa ederiz — bunu bizimle birlikte inşa edersiniz.' }
      },
      {
        id: 'v4', order: 3, icon: 'fa-solid fa-gauge-high', color: '#f59e0b',
        title: { en: 'Use It Without Getting Caught By Anti-Cheats', tr: 'Anti-Hilelere Takılmadan Kullan' },
        desc: { en: 'If Your Client Can Bypass Then Who Cares Making Good Configs', tr: 'Eğer Clientin Anti-Hileleri Bypasslayabiliyorsa Kim Neden İyi Bi Config Yapmaya Ugraşsın Ki' }
      }
    ],
    i18n: {
      en: {
        nav_home: 'Home', nav_products: 'Products', nav_about: 'About', nav_faq: 'FAQ', nav_contact: 'Contact',
        hero_badge: '🐰 RiseBunny Software — Live the Future Today',
        hero_title: 'We Code All Night. <span class="gradient-text">You Rise All Day.</span>',
        hero_sub: 'Discord bots, Minecraft clients, Brawl Stars projects — one RiseBunny crew.',
        hero_desc: 'From the RiseBunny Bot guarding servers 24/7 to Rubidium Client squeezing every frame: we build, ship and polish — non-stop.',
        btn_explore: 'Explore the Lab', btn_learn: 'Meet the Crew',
        prod_title: 'The Project Lab', prod_sub: 'Everything below is designed, coded and shipped under RiseBunny Software.',
        view_details: 'Inspect', status_dev: 'In the Lab', status_project: 'Prototype', status_active: 'Live 24/7',
        feat_title: 'Why RiseBunny Never Sleeps', feat_sub: 'Four obsessions behind every release.',
        about_title: 'Born to Rise.',
        about_p1: 'RiseBunny started as a small crew shipping a Discord bot with AI registration, subscriber roles, economy and raid-proof protection. Today the same crew builds Minecraft clients and game projects.',
        about_p2: 'One rule never changed: ship fast, update constantly, and keep every project free for the community.',
        eco_title: 'Where We Operate', eco_sub: 'If there is an API out there, we are probably building for it.',
        faq_title: 'Questions? We Answer Fast.',
        contact_title: 'Got an Idea? Let Us Build It.', contact_sub: 'Feedback, collabs, bug reports or wild ideas — the inbox is open.',
        discord_title: 'Join the War Room', discord_desc: 'New builds drop on our Discord first. The invite link lands here very soon.',
        lbl_name: 'Name', lbl_email: 'Email', lbl_subject: 'Subject', lbl_message: 'Message',
        ph_name: 'Your name', ph_email: 'you@example.com', ph_subject: 'Subject', ph_message: 'Your message...',
        btn_send: 'Send It', btn_sending: 'Flying…', form_success: 'Message landed!', form_mailto: 'Opening your mail app…',
        form_note: 'Encrypted end-to-end. No spam, ever.',
        footer_slogan: 'Rise Beyond Limits.', footer_nav: 'Navigation', footer_legal: 'Legal', footer_contact: 'Contact',
        privacy: 'Privacy Policy', terms: 'Terms of Service',
        copyright: '© 2026 RiseBunny. All rights reserved.',
        modal_features: 'Under the Hood', btn_community: 'Join the Crew', btn_download: 'Cooking…', btn_download_now: 'Get It',
        stat_cycle: 'Dev cycle', stat_free: 'Free forever', stat_excuses: 'Excuses', stat_ideas: 'Ideas in the backlog'
      },
      tr: {
        nav_home: 'Ana Sayfa', nav_products: 'Ürünler', nav_about: 'Hakkımızda', nav_faq: 'SSS', nav_contact: 'İletişim',
        hero_badge: '🐰 RiseBunny Software — Geleceği Bugünden Yaşa',
        hero_title: 'Biz Gece Kodlarız. <span class="gradient-text">Sen Gündüz Yükselirsin.</span>',
        hero_sub: 'Discord botları, Minecraft istemcileri, Brawl Stars projeleri — tek RiseBunny ekibi.',
        hero_desc: 'Sunucuları 7/24 koruyan RiseBunny Bot ile her kareyi zorlayan Rubidium Client aynı atölyeden çıkıyor: geliştir, yayınla, parlat — durmadan.',
        btn_explore: 'Laboratuvarı Keşfet', btn_learn: 'Ekiple Tanış',
        prod_title: 'Proje Laboratuvarı', prod_sub: 'Aşağıdaki her şey RiseBunny Software çatısında tasarlandı, kodlandı ve yayınlandı.',
        view_details: 'İncele', status_dev: 'Laboratuvarda', status_project: 'Prototip', status_active: '7/24 Yayında',
        feat_title: 'RiseBunny Neden Uyumaz?', feat_sub: 'Her sürümün arkasındaki dört takıntı.',
        about_title: 'Yükselmek İçin Doğduk.',
        about_p1: 'RiseBunny; yapay zeka kayıt, abone rol sistemi, ekonomi ve raid dayanıklı koruma sunan bir Discord botuyla yola çıktı. Bugün aynı ekip Minecraft istemcileri ve oyun projeleri geliştiriyor.',
        about_p2: 'Kural hiç değişmedi: hızlı yayınla, sürekli güncelle, her projeyi topluluk için ücretsiz tut.',
        eco_title: 'Operasyon Sahalarımız', eco_sub: 'Bir yerlerde bir API varsa, biz orada geliştiriyoruz.',
        faq_title: 'Sorun mu Var? Hızlı Cevaplar.',
        contact_title: 'Fikrin mi Var? Biz İnşa Edelim.', contact_sub: 'Geri bildirim, iş birliği, hata raporu ya da çılgın fikirler — kutu açık.',
        discord_title: 'Komuta Merkezine Katıl', discord_desc: 'Yeni buildler ilk olarak Discord sunucumuzda paylaşılır. Davet linki çok yakında burada.',
        lbl_name: 'İsim', lbl_email: 'E-posta', lbl_subject: 'Konu', lbl_message: 'Mesaj',
        ph_name: 'Adınız', ph_email: 'ornek@eposta.com', ph_subject: 'Konu', ph_message: 'Mesajınız...',
        btn_send: 'Gönder', btn_sending: 'Uçuyor…', form_success: 'Mesaj ulaştı!', form_mailto: 'E-posta uygulaması açılıyor…',
        form_note: 'Uçtan uca şifreli. Spam yok, asla.',
        footer_slogan: 'Sınırların Ötesine Yüksel.', footer_nav: 'Navigasyon', footer_legal: 'Yasal', footer_contact: 'İletişim',
        privacy: 'Gizlilik Politikası', terms: 'Kullanım Şartları',
        copyright: '© 2026 RiseBunny. Tüm hakları saklıdır.',
        modal_features: 'Kaputun Altında', btn_community: 'Ekibe Katıl', btn_download: 'Pişiyor…', btn_download_now: 'İndir',
        stat_cycle: 'Geliştirme döngüsü', stat_free: 'Sonsuza dek ücretsiz', stat_excuses: 'Bahane', stat_ideas: 'Bekleyen fikir'
      }
    }
  };
})();
