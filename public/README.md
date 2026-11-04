# 📁 `/public` - Arquivos Estáticos

Arquivos públicos acessíveis diretamente via URL (imagens, ícones, documentos).

---

## 📄 O Que Vai Nesta Pasta

### Imagens e Ícones
```
public/
├── logo.png          # Logo da Prefeitura
├── favicon.ico       # Ícone da aba do navegador
├── logo-integrasaude.svg # Logo do IntegraSaude
└── img/
    ├── icons/
    │   ├── home.svg
    │   ├── user.svg
    │   └── settings.svg
    └── ilustracoes/
        ├── empty-state.svg
        └── error-404.svg
```

### Documentos
```
public/
└── docs/
    ├── manual-usuario.pdf
    ├── politica-privacidade.pdf
    └── termos-de-uso.pdf
```

### Assets CSS/JS Externos
```
public/
└── vendor/
    ├── bootstrap.min.css
    └── jquery.min.js
```

---

## 🌐 Como Acessar Arquivos

### No Código
```javascript
// Imagem
<img src="/logo.png" alt="Logo" />

// CSS externo
<link rel="stylesheet" href="/vendor/bootstrap.min.css" />

// Script externo
<script src="/vendor/jquery.min.js"></script>
```

### Via URL
```
http://localhost:3000/logo.png
http://localhost:3000/docs/manual-usuario.pdf
http://localhost:3000/img/icons/home.svg
```

**Importante:** A URL **NÃO** inclui `/public`, apenas o caminho após ela.

---

## 📦 Estrutura Recomendada

```
public/
├── img/                      # Imagens
│   ├── logo.png
│   ├── icons/                # Ícones SVG
│   │   ├── home.svg
│   │   ├── user.svg
│   │   └── menu.svg
│   ├── avatars/              # Avatars padrão
│   │   └── default.png
│   └── illustrations/        # Ilustrações
│       ├── empty-state.svg
│       └── error.svg
├── docs/                     # Documentos PDF
│   ├── manual.pdf
│   └── relatorio-exemplo.pdf
├── fonts/                    # Fontes customizadas
│   ├── inter-regular.woff2
│   └── inter-bold.woff2
├── favicon.ico               # Favicon
├── robots.txt                # SEO: instruções para crawlers
└── manifest.json             # PWA: configuração do app
```

---

## 🎨 Otimização de Imagens

### Next.js Image Component
**Recomendado:** Usar `<Image>` do Next.js em vez de `<img>`

```javascript
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority // Carregar com prioridade
/>
```

**Benefícios:**
- ✅ Lazy loading automático
- ✅ Otimização de tamanho
- ✅ Responsivo (srcset)
- ✅ Blur placeholder
- ✅ Converte para WebP automaticamente

### Imagens Externas
```javascript
// next.config.mjs
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
};
```

---

## 📱 Favicon e PWA

### `favicon.ico`
**Função:** Ícone que aparece na aba do navegador.

**Formatos suportados:**
- `.ico` (recomendado)
- `.png`
- `.svg`

**Gerar favicons:**
```bash
# Ferramenta online:
https://realfavicongenerator.net/
```

### `manifest.json`
**Função:** Configuração para Progressive Web App (PWA).

```json
{
  "name": "IntegraSaude",
  "short_name": "IntegraSaude",
  "description": "Sistema de Gestão Municipal de Saúde",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0070f3",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Referência no `layout.js`:**
```javascript
<link rel="manifest" href="/manifest.json" />
```

---

## 🤖 SEO e Crawlers

### `robots.txt`
**Função:** Instruções para motores de busca.

```txt
# public/robots.txt

# Permitir todos os crawlers
User-agent: *
Allow: /

# Bloquear admin
Disallow: /admin/

# Sitemap
Sitemap: https://seudominio.com/sitemap.xml
```

### `sitemap.xml`
**Função:** Mapa do site para SEO.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://seudominio.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://seudominio.com/dashboard</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

---

## 📊 Tipos de Arquivos

### ✅ O que PODE ir no `/public`
- Imagens (PNG, JPG, SVG, WebP)
- Ícones e logos
- Documentos PDF
- Fontes customizadas
- Arquivos de configuração (robots.txt, manifest.json)
- Assets de bibliotecas externas

### ❌ O que NÃO deve ir no `/public`
- Componentes React (vai em `/src/components`)
- Arquivos CSS Modules (vai junto com componentes)
- Arquivos JavaScript do projeto (vai em `/src`)
- Dados sensíveis ou credenciais
- Arquivos temporários ou de build

---

## 🔐 Segurança

### Arquivos Sensíveis
**NUNCA coloque no `/public`:**
- ❌ `.env` ou credenciais
- ❌ Chaves API
- ❌ Certificados SSL
- ❌ Backups de banco
- ❌ Logs do sistema

**Por quê?**
- Tudo em `/public` é acessível diretamente via URL
- Não há proteção de autenticação
- Bots podem descobrir e acessar

### Arquivos Grandes
**Evite arquivos muito grandes:**
- ⚠️ Vídeos (use serviços externos como YouTube, Vimeo)
- ⚠️ PDFs muito grandes (> 5MB)
- ⚠️ Imagens não otimizadas

**Alternativas:**
- Upload para CDN (Cloudinary, AWS S3)
- Streaming de vídeos
- Compressão de imagens

---

## 🚀 Performance

### Compressão de Imagens
```bash
# TinyPNG (online)
https://tinypng.com/

# ImageOptim (Mac)
https://imageoptim.com/

# Squoosh (Web)
https://squoosh.app/
```

### Formatos Modernos
```
PNG  → WebP  (70% menor)
JPG  → WebP  (25-35% menor)
SVG  → Já otimizado (texto)
```

### Next.js faz automaticamente:
- ✅ Serve WebP quando suportado
- ✅ Lazy loading de imagens
- ✅ Cache otimizado

---

## 📁 Exemplo Completo

```
public/
├── favicon.ico
├── manifest.json
├── robots.txt
├── img/
│   ├── logo-integrasaude.svg
│   ├── logo-prefeitura.png
│   ├── icons/
│   │   ├── home.svg
│   │   ├── user.svg
│   │   ├── settings.svg
│   │   ├── logout.svg
│   │   └── menu.svg
│   ├── avatars/
│   │   └── default.png
│   ├── illustrations/
│   │   ├── empty-state.svg
│   │   ├── error-404.svg
│   │   ├── error-500.svg
│   │   └── loading.svg
│   └── backgrounds/
│       ├── login-bg.jpg
│       └── dashboard-pattern.svg
├── docs/
│   ├── manual-usuario.pdf
│   ├── politica-privacidade.pdf
│   └── guia-rapido.pdf
└── fonts/
    ├── inter-regular.woff2
    ├── inter-medium.woff2
    └── inter-bold.woff2
```

---

## 🔗 Uso no Código

### Imagens
```javascript
// HTML tradicional
<img src="/img/logo.png" alt="Logo" />

// Next.js Image (recomendado)
import Image from 'next/image';
<Image src="/img/logo.png" alt="Logo" width={200} height={100} />

// CSS
.hero {
  background-image: url('/img/backgrounds/login-bg.jpg');
}
```

### Documentos
```javascript
<a href="/docs/manual-usuario.pdf" target="_blank">
  Ver Manual
</a>
```

### Fontes
```css
/* globals.css */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}
```

---

## 📚 Referências

- [Next.js Static Files](https://nextjs.org/docs/app/building-your-application/optimizing/static-assets)
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [PWA Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
