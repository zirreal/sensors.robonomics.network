<template>
  <RouterView />
  <notifications :classes="['notify', 'vue-notification']" />
</template>

<script setup>
import { RouterView } from "vue-router";

import { waitReady } from '@polkadot/wasm-crypto';
import { onMounted } from "vue";
import { useAccountStore } from "@/stores/account";
import { IDBgettable, decryptText } from "@/idb";
import config from "@/config/default/config.json";

const accountStore = useAccountStore();

onMounted(async () => {
  
  await waitReady();

  const accounts = await IDBgettable(
    config.INDEXEDDB.accounts.dbname,
    config.INDEXEDDB.accounts.dbversion,
    config.INDEXEDDB.accounts.tablename
  );

  if (accounts && accounts.length > 0) {
    let selected = accounts.find(acc => acc.active);
    if (!selected) selected = accounts[0];

    let phrase = "";
    try {
      phrase = await decryptText(selected.data);
    } catch (e) {
      phrase = "";
    }

    accountStore.setAccount(
      phrase,
      selected.address,
      selected.type,
      selected.devices
    );
  }
});
</script>

<style>
.notify {
  font-size: 20px !important;
  font-weight: bold;
}
</style>
