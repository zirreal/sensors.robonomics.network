import { ApiPromise, WsProvider } from "@polkadot/api";
import Keyring from "@polkadot/keyring";
import { datalog } from "robonomics-interface";

// const WS_ENDPOINT = "wss://polkadot.rpc.robonomics.network/";
const WS_ENDPOINT = "wss://kusama.rpc.robonomics.network/";

let apiPromise = null;

async function getApi() {
  if (!apiPromise) {
    const provider = new WsProvider(WS_ENDPOINT);
    apiPromise = await ApiPromise.create({ provider });
    await apiPromise.isReady;
  }
  return apiPromise;
}

export async function sendStoryToDatalog({ phrase, payload }) {
  if (!phrase || typeof phrase !== "string") {
    throw new Error("Missing account phrase");
  }
  const api = await getApi();
  const keyring = new Keyring({ ss58Format: 32 });
  const pair = keyring.addFromMnemonic(phrase.trim());

  const data = JSON.stringify(payload);
  const tx = datalog.action.write(api, data);

  return new Promise((resolve, reject) => {
    let unsub = null;
    tx.signAndSend(pair, (result) => {
      const { status, dispatchError, txHash } = result;
      if (dispatchError) {
        try {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const msg = `${decoded.section}.${decoded.name}`;
            reject(new Error(msg));
          } else {
            reject(new Error(dispatchError.toString()));
          }
        } finally {
          if (unsub) unsub();
        }
        return;
      }

      if (status?.isInBlock || status?.isFinalized) {
        if (unsub) unsub();
        resolve({
          status: status.type,
          hash: txHash?.toHex?.() || tx.hash?.toHex?.(),
        });
      }
    })
      .then((u) => {
        unsub = u;
      })
      .catch((e) => reject(e));
  });
}

