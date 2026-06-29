# FinanceOS Design Language

> Esta é a constituição visual do FinanceOS. Toda decisão de design parte daqui.  
> Nenhuma tela deve usar valores que não estejam listados abaixo.

---

## 1. Espaçamento

Todos os valores de margin, padding e gap devem ser múltiplos do grid base de 4px.

| Token | Valor | Uso |
|---|---|---|
| `space-1` | 4px | Micro-ajustes, gaps de ícone |
| `space-2` | 8px | Gaps internos pequenos |
| `space-3` | 12px | Lista de itens, espaços de grupo |
| `space-4` | 16px | Padding de card pequeno, grid gap |
| `space-5` | 20px | Padding interno de card padrão |
| `space-6` | 24px | Padding de seção, separação entre blocos |
| `space-8` | 32px | Padding de header, auth wrappers |

**Regra:** Nunca usar valores arbitrários como `p-[18px]` ou `mt-[22px]`.

---

## 2. Border Radius

| Uso | Valor | Tailwind |
|---|---|---|
| Inputs, buttons, badges | 12px | `rounded-xl` |
| Cards internos, items de lista | 16px | `rounded-2xl` |
| Cards principais, dialogs, sheets | 24px | `rounded-3xl` |

---

## 3. Animações

| Contexto | Duração | Easing |
|---|---|---|
| Hover (botões, cards) | 120ms | `ease-out` |
| Saída (dismiss, fade-out) | 150ms | `ease-in` |
| Entrada (modais, cards, toasts) | 180ms | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| Bottom Sheets, Drawers | 240ms | Spring (`stiffness: 300, damping: 30`) |
| Swipe actions | 200ms | Spring |

**Regra:** Sempre respeitar `prefers-reduced-motion`. Quando ativo, todas as animações devem ser instantâneas (`duration: 0`).

---

## 4. Glassmorphism

| Propriedade | Valor |
|---|---|
| `backdrop-filter` | `blur(18px)` |
| Background opacity | `0.65` |
| Border | `1px solid rgba(51,65,85,0.45)` |
| Box shadow | `0 8px 32px rgba(0,0,0,0.37)` |

---

## 5. Cards

| Propriedade | Valor |
|---|---|
| Padding interno | `20px` (`p-5`) |
| Gap entre elementos internos | `16px` (`gap-4`) |
| Radius | `rounded-2xl` (interno) ou `rounded-3xl` (principal) |

---

## 6. Componentes Interativos

| Componente | Altura | Radius |
|---|---|---|
| Input | 44px | `rounded-xl` |
| Button primário | 44px | `rounded-xl` |
| Button de header | 36px | `rounded-xl` |
| Bottom Nav | 76px | — |

**Active state:** `scale(0.97)` — nunca `scale(0.90)` (muito agressivo) nem `scale(1.0)` (sem feedback).

---

## 7. Design Tokens (CSS Custom Properties)

Em vez de cores hardcoded, todas as telas usam tokens semânticos:

```css
/* Surfaces */
--color-bg           /* Fundo da tela */
--color-surface      /* Fundo de card/painel */
--color-surface-alt  /* Fundo alternativo (input, etc.) */
--color-border       /* Borda padrão */

/* Texto */
--color-text-primary   /* Texto principal */
--color-text-secondary /* Texto secundário / labels */
--color-text-muted     /* Texto de suporte / captions */

/* Ação */
--color-accent         /* Indigo — CTA principal */
--color-success        /* Emerald — receitas, confirmações */
--color-danger         /* Rose — despesas, exclusões */
--color-warning        /* Amber — pendências */
```

---

## 8. Hierarquia de Widgets do Dashboard

| Tipo | Conteúdo | Componente |
|---|---|---|
| `KPIWidget` | Número, tendência, ícone | Métricas mensuráveis (saldo, receitas, despesas) |
| `InfoWidget` | Texto descritivo, link | Informações contextuais (próxima conta, última movimentação) |
| `ChartWidget` | Gráfico SVG/canvas | Visualizações (distribuição, evolução) — Sprint 5+ |

Todos usam o mesmo `Card` como container base.

---

## 9. Toast Queue

- Nunca exibir dois toasts ao mesmo tempo.
- Fila FIFO: o próximo exibe após o anterior desaparecer (ou após 200ms de overlap).
- Tipos: `success` | `error` | `warning` | `info`
- Posição: `top-right` (desktop), `top-center` (mobile)
- Duração padrão: 3500ms

---

## 10. ActionRow Strategy

O `ActionRow` é o container de ação de qualquer item de lista. Ele delega o comportamento para uma estratégia:

| Estratégia | Trigger | Ação |
|---|---|---|
| `HoverStrategy` | Mouse hover | Revela botões de ação inline |
| `SwipeStrategy` | Touch drag | Deslizar esquerda = excluir, direita = editar |
| `LongPressStrategy` | Long press | Context menu (futuro) |
| `KeyboardStrategy` | Tab + Enter/Delete | Navegação por teclado (futuro) |

---

## 11. Serviços & Repositórios

Toda camada de acesso a dados deve respeitar a interface:

```ts
interface DashboardRepository {
  getSnapshot(userId: string, range: DateRange): Promise<DashboardSnapshot>
}
```

O `DashboardService` usa `DashboardRepository`. Amanhã pode existir `OfflineDashboardRepository`, `CachedDashboardRepository` — sem alterar o service.

---

## 12. Haptic Service

```ts
haptic.success()   // navigator.vibrate(10)
haptic.error()     // navigator.vibrate([20, 50, 20])
haptic.warning()   // navigator.vibrate(15)
```

Sempre verificar suporte antes de chamar. Graceful degradation silenciosa.

---

## 13. Roadmap de Sprints

| Sprint | Foco |
|---|---|
| **2** | UX, Design System, Mobile First |
| **3** | Performance (lazy, Suspense, cache) |
| **4** | Offline (IndexedDB, sync) |
| **5** | MoneyBridge |
| **6** | Transferências |
| **7** | Open Finance |
| **8** | Lucro Simples |
