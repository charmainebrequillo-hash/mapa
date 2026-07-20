import { nativeToScVal, scValToNative, xdr, Address, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { getRpc, getContract, getNetwork } from "./stellar";

export const arg = {
  u64: (v: number) => nativeToScVal(v, { type: "u64" }),
  i128: (v: number | bigint) => nativeToScVal(v, { type: "i128" }),
  u128: (v: number | bigint) => nativeToScVal(v, { type: "u128" }),
  address: (v: string) => new Address(v).toScVal(),
  string: (v: string) => nativeToScVal(v, { type: "string" }),
  bool: (v: boolean) => nativeToScVal(v),
  vec: (items: xdr.ScVal[]) => xdr.ScVal.scvVec(items),
};

export async function readContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  sourceKey?: string
) {
  const server = getRpc();
  const contract = getContract(contractId);
  const op = contract.call(method, ...params);

  const source = sourceKey || "GBHBOPW5AMW5J6RRR4YU2NLJI3HRX7SG4Q4ZZBJILLDR3644INLHMMZZ";
  const account = await server.getAccount(source).catch(
    () => new Account(source, "0")
  );

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: getNetwork(),
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if ("error" in sim) {
    throw new Error("Simulation failed: " + sim.error + " " + JSON.stringify(sim));
  }
  if (!sim.result) {
    throw new Error("Simulation returned no result: " + JSON.stringify(sim));
  }

  return scValToNative(sim.result.retval);
}

export async function writeContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  publicKey: string,
  signTx: (tx: string) => Promise<string>
) {
  const server = getRpc();
  const contract = getContract(contractId);
  const op = contract.call(method, ...params);

  const account = await server.getAccount(publicKey);

  const transaction = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: getNetwork(),
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(transaction);
  const txXdr = preparedTx.toEnvelope().toXDR("base64");
  const signedXdr = await signTx(txXdr);
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetwork());
  const result = await server.sendTransaction(signedTx);

  if (result.status === "PENDING") {
    const hash = result.hash;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await server.getTransaction(hash);
      if (res.status === "SUCCESS") {
        return scValToNative(res.returnValue!);
      }
      if (res.status === "FAILED") {
        throw new Error("Transaction failed: " + JSON.stringify(res));
      }
      attempts++;
    }
    throw new Error("Transaction timeout");
  }

  throw new Error("Transaction submission failed: " + JSON.stringify(result));
}
