<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label?: string;
    monogram?: string;
  }>(),
  {
    label: "Break the seal to unseal the record.",
    monogram: "",
  },
);

const emit = defineEmits<{
  unsealed: [];
}>();

const rawId = useId();
const idPrefix = computed(() => rawId.replace(/[^a-zA-Z0-9_-]/g, ""));
const breaking = ref(false);
const gone = ref(false);
const prefersReducedMotion = ref(false);
let revealTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
});

onBeforeUnmount(() => {
  if (revealTimer) clearTimeout(revealTimer);
});

function breakSeal() {
  if (breaking.value || gone.value) return;
  breaking.value = true;

  revealTimer = setTimeout(
    () => {
      gone.value = true;
      emit("unsealed");
    },
    prefersReducedMotion.value ? 0 : 900,
  );
}
</script>

<template>
  <button
    v-if="!gone"
    class="seal-gate"
    :class="{ breaking }"
    type="button"
    :aria-label="props.label"
    @click="breakSeal"
  >
    <svg
      class="wax-seal"
      viewBox="0 0 200 200"
      width="128"
      height="128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient :id="`${idPrefix}-wax-grad`" cx="38%" cy="32%" r="76%">
          <stop offset="0%" stop-color="#d95a4b" />
          <stop offset="48%" stop-color="#a03030" />
          <stop offset="100%" stop-color="#5a1713" />
        </radialGradient>
        <radialGradient
          :id="`${idPrefix}-stamp-grad`"
          cx="45%"
          cy="38%"
          r="64%"
        >
          <stop offset="0%" stop-color="#b84036" />
          <stop offset="100%" stop-color="#741b16" />
        </radialGradient>
        <clipPath :id="`${idPrefix}-clip-left`">
          <rect x="0" y="0" width="100" height="200" />
        </clipPath>
        <clipPath :id="`${idPrefix}-clip-right`">
          <rect x="100" y="0" width="100" height="200" />
        </clipPath>
      </defs>

      <g class="half left">
        <g :clip-path="`url(#${idPrefix}-clip-left)`">
          <path
            class="wax-body"
            d="M100 12 C135 8 168 28 180 55 C192 82 190 120 178 148 C166 176 135 192 100 190 C65 188 32 174 20 146 C8 118 10 80 24 52 C38 24 65 16 100 12 Z"
            :fill="`url(#${idPrefix}-wax-grad)`"
          />
          <circle
            class="wax-ring"
            cx="100"
            cy="100"
            r="61"
            :fill="`url(#${idPrefix}-stamp-grad)`"
          />
          <circle class="wax-inner-rule" cx="100" cy="100" r="47" fill="none" />
          <text class="seal-monogram" x="100" y="116" text-anchor="middle">
            {{ props.monogram }}
          </text>
          <ellipse
            class="wax-highlight"
            cx="69"
            cy="54"
            rx="29"
            ry="13"
            transform="rotate(-25 69 54)"
          />
        </g>
      </g>

      <g class="half right">
        <g :clip-path="`url(#${idPrefix}-clip-right)`">
          <path
            class="wax-body"
            d="M100 12 C135 8 168 28 180 55 C192 82 190 120 178 148 C166 176 135 192 100 190 C65 188 32 174 20 146 C8 118 10 80 24 52 C38 24 65 16 100 12 Z"
            :fill="`url(#${idPrefix}-wax-grad)`"
          />
          <circle
            class="wax-ring"
            cx="100"
            cy="100"
            r="61"
            :fill="`url(#${idPrefix}-stamp-grad)`"
          />
          <circle class="wax-inner-rule" cx="100" cy="100" r="47" fill="none" />
          <text class="seal-monogram" x="100" y="116" text-anchor="middle">
            {{ props.monogram }}
          </text>
        </g>
      </g>

      <path
        class="crack"
        d="M96 15 L104 45 L94 78 L107 108 L95 140 L103 168 L98 188"
      />
    </svg>
    <span class="seal-copy">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.seal-gate {
  display: block;
  width: 100%;
  padding: 56px 0 68px;
  border: 0;
  background: transparent;
  color: var(--parchment-dim);
  cursor: pointer;
  font-style: italic;
  text-align: center;
  user-select: none;
}

.wax-seal {
  display: block;
  overflow: visible;
  margin: 0 auto 18px;
  filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.34))
    drop-shadow(0 0 24px rgba(160, 48, 48, 0.34));
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.seal-gate:hover .wax-seal {
  filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.4))
    drop-shadow(0 0 32px rgba(160, 48, 48, 0.46));
  transform: scale(1.045) rotate(-2deg);
}

.seal-gate:focus-visible {
  outline: 1px solid var(--gold);
  outline-offset: 8px;
}

.seal-copy {
  display: block;
  line-height: 1.7;
}

.wax-body {
  stroke: rgba(14, 13, 11, 0.36);
  stroke-width: 1.5;
}

.wax-ring {
  stroke: rgba(14, 13, 11, 0.62);
  stroke-width: 2;
}

.wax-inner-rule {
  opacity: 0.5;
  stroke: rgba(237, 228, 208, 0.2);
  stroke-width: 1.2;
  stroke-dasharray: 4 5;
}

.seal-monogram {
  fill: rgba(237, 228, 208, 0.72);
  font-family: var(--mono);
  font-size: 32px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 4px;
}

.wax-highlight {
  fill: rgba(237, 228, 208, 0.18);
  mix-blend-mode: screen;
}

.crack {
  opacity: 0;
  fill: none;
  stroke: #3d0d07;
  stroke-linecap: round;
  stroke-width: 3;
}

.half {
  transform-box: view-box;
  transform-origin: 100px 100px;
}

.breaking {
  pointer-events: none;
}

.breaking .crack {
  animation: crack-appear 0.14s ease forwards;
}

.breaking .half.left {
  animation: split-left 0.78s ease-in 0.12s forwards;
}

.breaking .half.right {
  animation: split-right 0.78s ease-in 0.12s forwards;
}

@keyframes crack-appear {
  to {
    opacity: 1;
  }
}

@keyframes split-left {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }

  100% {
    opacity: 0;
    transform: translate(-72px, 42px) rotate(-25deg);
  }
}

@keyframes split-right {
  0% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
  }

  100% {
    opacity: 0;
    transform: translate(72px, 42px) rotate(25deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wax-seal {
    transition: none;
  }

  .seal-gate:hover .wax-seal {
    transform: none;
  }

  .breaking .crack,
  .breaking .half.left,
  .breaking .half.right {
    animation: none;
  }
}
</style>
