<script setup lang="ts">
interface Props {
  actionTo?: string
  actionLabel?: string
}

withDefaults(defineProps<Props>(), {
  actionTo: '/methodology',
  actionLabel: 'Methodology'
})
</script>

<template>
  <header class="court-header">
    <NuxtLink v-if="actionLabel" class="court-link" :to="actionTo">
      {{ actionLabel }}
    </NuxtLink>
    <NuxtLink class="tribunal-title" to="/">The Authorship Tribunal</NuxtLink>
    <div class="motto">manu aut machina — by hand, or by machine</div>
    <hr class="double-rule" />
  </header>
</template>
