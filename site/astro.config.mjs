import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://candril.github.io',
  base: '/lane',
  integrations: [
    starlight({
      title: 'lane',
      description: 'Terminal Kanban board for Jira. Keyboard-first, vim-flavoured, config-driven.',
      logo: {
        src: './src/assets/logo.svg',
      },
      favicon: '/logo.svg',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/candril/lane',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/candril/lane/edit/main/site/',
      },
      sidebar: [
        {
          label: 'Guide',
          items: [
            { label: 'Installation', slug: 'guide/installation' },
            { label: 'Getting Started', slug: 'guide/getting-started' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Key Bindings', slug: 'reference/key-bindings' },
            { label: 'Views & Tabs', slug: 'reference/views' },
            { label: 'Working with Issues', slug: 'reference/issues' },
            { label: 'Filtering & Search', slug: 'reference/filtering' },
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'CLI', slug: 'reference/cli' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
  ],
})
