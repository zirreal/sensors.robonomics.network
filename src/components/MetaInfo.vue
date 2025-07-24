<template></template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'

import config from "@config";

const props = defineProps({
  pageTitle: { type: String, default: '' },
  pageDescription: {
    type: String,
    default:
      'Robonomics team invite you to use new internet technologies for your IoT devices. This map is open source project with aim to present example of using ipfs, ethereum and polkadot tech for Smart cities applications developers.'
  },
  pageImage: { type: String, default: '' },
  pageImageWidth: { type: String, default: '1280' },
  pageImageHeight: { type: String, default: '765' }
})

const siteName = config.SITE_NAME;
const siteUrl = config.SITE_URL;

const route = useRoute()

const title = computed(() =>
  props.pageTitle ? `${props.pageTitle} / ${siteName}` : siteName
)

const description = computed(() => props.pageDescription)

const image = computed(() =>
  props.pageImage ? props.pageImage : siteUrl + '/og-default.webp'
)

const fullUrl = computed(() => siteUrl + route.fullPath)

useHead({
  title: title.value,
  htmlAttrs: {
    lang: 'en',
    amp: true,
    dir: 'ltr'
  },
  meta: [
    { name: 'description', content: description.value },

    // Open Graph
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: siteName },
    { property: 'og:title', content: title.value },
    { property: 'og:description', content: description.value },
    { property: 'og:image', content: image.value },
    { property: 'og:image:width', content: props.pageImageWidth },
    { property: 'og:image:height', content: props.pageImageHeight },
    { property: 'og:url', content: fullUrl.value },

    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title.value },
    { name: 'twitter:image', content: image.value },
    { name: 'twitter:description', content: description.value },
    { name: 'twitter:site', content: config.TWITTER },
    { name: 'twitter:creator', content: config.TWITTER }
  ]
})
</script>
