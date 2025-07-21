<template>
    <Header />
    <section class="container-pagetext">
        <slot />
    </section>
    <footer>
        <AltruistPromo utmMedium="footer" />
    </footer>
</template>

<script setup>
import Header from '../header/Header.vue';
import AltruistPromo from "../devices/altruist/AltruistPromo.vue";
</script>

<style>

.container-pagetext > * {
  --font-size: 1.3rem;
  --gap: 1.7rem;
  line-height: 1.5;
}

@media (width < 800px) {
  .container-pagetext > * {
    --gap: 1.4rem;
  }
}

.container-pagetext {
  padding: calc(var(--gap) * 5) calc(var(--gap) * 3) calc(var(--gap) * 3);
  margin: 0 auto;
  max-width: 1400px;
}

.container-pagetext section:not(:last-child) {
  margin-bottom: calc(var(--gap) * 3);
}

.container-pagetext ul{
  list-style: initial;
  margin-left: var(--gap);
}

.pagetext-highlight {
  font-weight: 900;
}

.pagetext-fullwidth-image {
  display: block;
  width: 100vw;
  max-width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
}

</style>

<style scoped>
    footer {
        margin-top: calc(var(--gap) * 3);    
    }
</style>