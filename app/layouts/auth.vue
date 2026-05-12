<template>
  <div class="flex min-h-dvh flex-col bg-default">
    <div class="flex flex-1 items-center justify-center p-6">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <NuxtLink to="/" class="text-xl font-bold text-highlighted">
            Onward
          </NuxtLink>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>
