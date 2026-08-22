<script setup lang="ts">
// Marketing now lives on the client's WordPress site, so the app root is just
// the login page. Redirect every visitor to /login, which itself forwards an
// already-authenticated user on to /generate. Runs on SSR (inbound WordPress
// links) and client-side navigation alike.
definePageMeta({
  middleware: () => navigateTo('/login', { redirectCode: 302 }),
})
</script>

<template>
  <div />
</template>
