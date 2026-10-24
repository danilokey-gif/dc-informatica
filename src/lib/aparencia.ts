/**
 * Aparência do sistema escolhida em cada computador (botão "Aparência" no topo).
 * Fica gravada em cookies para a página já chegar do servidor com as cores e o menu certos.
 */
export const TEMAS = [
  { id: 'indigo', nome: 'Escuro índigo', cores: ['#0d1117', '#151a23', '#6366f1'] },
  { id: 'grafite', nome: 'Grafite e vermelho', cores: ['#111214', '#18181b', '#c8102e'] },
  { id: 'claro', nome: 'Claro', cores: ['#f4f6f9', '#ffffff', '#c8102e'] },
  { id: 'marinho', nome: 'Azul-marinho', cores: ['#eef2f7', '#0f2a4a', '#1d4ed8'] },
] as const

export const LAYOUTS = [
  { id: 'lateral', nome: 'Menu lateral', texto: 'Menu à esquerda' },
  { id: 'topo', nome: 'Topo com submenus', texto: 'Grupos no topo que abrem uma lista' },
  { id: 'faixas', nome: 'Topo em duas faixas', texto: 'Grupo em cima, telas dele embaixo' },
  { id: 'icones', nome: 'Topo com ícones', texto: 'Telas mais usadas direto na barra' },
] as const

export type Tema = (typeof TEMAS)[number]['id']
export type Layout = (typeof LAYOUTS)[number]['id']

export const COOKIE_TEMA = 'dc_tema'
export const COOKIE_LAYOUT = 'dc_layout'

export const lerTema = (v?: string): Tema => (TEMAS.some(t => t.id === v) ? (v as Tema) : 'indigo')
export const lerLayout = (v?: string): Layout => (LAYOUTS.some(l => l.id === v) ? (v as Layout) : 'lateral')
