// @flow
import type Transport from "@ledgerhq/hw-transport";
import { BigNumber } from "bignumber.js";
import { TransportStatusError } from "@ledgerhq/errors";
import invariant from "invariant";

const START_NEW_TRANSACTION_COMMAND: number = 0x03;
const SET_PARTNER_KEY_COMMAND: number = 0x04;
const CHECK_PARTNER_COMMAND: number = 0x05;
const PROCESS_TRANSACTION_RESPONSE: number = 0x06;
const CHECK_TRANSACTION_SIGNATURE: number = 0x07;
const CHECK_PAYOUT_ADDRESS: number = 0x08;  // CHECK_ASSET_IN for SELL
const CHECK_REFUND_ADDRESS: number = 0x09;  // unused for SELL
const SIGN_COIN_TRANSACTION: number = 0x0a;

type TransactionType =
  0x00 | // SWAP
  0x01   // SELL

const maybeThrowProtocolError = (result: Buffer): void => {
  invariant(result.length >= 2, "SwapTransport: Unexpected result length");
  const resultCode = result.readUInt16BE(result.length - 2);
  if (resultCode !== 0x9000) {
    throw new TransportStatusError(resultCode);
  }
};

export default class Swap {
  transport: Transport<*>;
  allowedStatuses: Array<number> = [
    0x9000,
    0x6a80,
    0x6a81,
    0x6a82,
    0x6a83,
    0x6a84,
    0x6a85,
    0x6e00,
    0x6d00,
    0x9d1a,
  ];

  constructor(transport: Transport<*>) {
    this.transport = transport;
  }

  async startNewTransaction(transactionType: TransactionType): Promise<string | Buffer> {
    let result: Buffer = await this.transport.send(
      0xe0,
      START_NEW_TRANSACTION_COMMAND,
      0x00,
      transactionType,
      Buffer.alloc(0),
      this.allowedStatuses
    );
    maybeThrowProtocolError(result);

    // SELL
    if (transactionType == 0x01) {
      return result.subarray(0, 32);
    }

  return result.toString("ascii", 0, 10);
  }

  async setPartnerKey(transactionType: TransactionType, partnerNameAndPublicKey: Buffer): Promise<void> {
    let result: Buffer = await this.transport.send(
      0xe0,
      SET_PARTNER_KEY_COMMAND,
      0x00,
      transactionType,
      partnerNameAndPublicKey,
      this.allowedStatuses
    );

    maybeThrowProtocolError(result);
  }

  async checkPartner(transactionType: TransactionType, signatureOfPartnerData: Buffer): Promise<void> {
    let result: Buffer = await this.transport.send(
      0xe0,
      CHECK_PARTNER_COMMAND,
      0x00,
      transactionType,
      signatureOfPartnerData,
      this.allowedStatuses
    );

    maybeThrowProtocolError(result);
  }

  async processTransaction(
    transactionType: TransactionType,
    transaction: Buffer,
    fee: BigNumber
  ): Promise<void> {
    var hex: string = fee.toString(16);
    hex = hex.padStart(hex.length + (hex.length % 2), "0");
    var feeHex: Buffer = Buffer.from(hex, "hex");

    const bufferToSend: Buffer = Buffer.concat([
      Buffer.from([transaction.length]),
      transaction,
      Buffer.from([feeHex.length]),
      feeHex,
    ]);

    let result: Buffer = await this.transport.send(
      0xe0,
      PROCESS_TRANSACTION_RESPONSE,
      0x00,
      transactionType,
      bufferToSend,
      this.allowedStatuses
    );

    maybeThrowProtocolError(result);
  }

  async checkTransactionSignature(
    transactionType: TransactionType,
    transactionSignature: Buffer
  ): Promise<void> {
    let result: Buffer = await this.transport.send(
      0xe0,
      CHECK_TRANSACTION_SIGNATURE,
      0x00,
      transactionType,
      transactionSignature,
      this.allowedStatuses
    );
    maybeThrowProtocolError(result);
  }

  async checkPayoutAddress(
    transactionType: TransactionType,
    payoutCurrencyConfig: Buffer,
    currencyConfigSignature: Buffer,
    addressParameters: Buffer
  ): Promise<void> {
    invariant(payoutCurrencyConfig.length <= 255, "Currency config is too big");
    invariant(addressParameters.length <= 255, "Address parameter is too big.");
    invariant(
      currencyConfigSignature.length >= 70 &&
        currencyConfigSignature.length <= 73,
      "Signature should be DER serialized and have length in [70, 73] bytes."
    );

    const bufferToSend: Buffer = Buffer.concat([
      Buffer.from([payoutCurrencyConfig.length]),
      payoutCurrencyConfig,
      currencyConfigSignature,
      Buffer.from([addressParameters.length]),
      addressParameters,
    ]);

    let result: Buffer = await this.transport.send(
      0xe0,
      CHECK_PAYOUT_ADDRESS, // CHECK_ASSET_IN for SELL
      0x00,
      transactionType,
      bufferToSend,
      this.allowedStatuses
    );
    maybeThrowProtocolError(result);
  }

  async checkRefundAddress(
    refundCurrencyConfig: Buffer,
    currencyConfigSignature: Buffer,
    addressParameters: Buffer
  ): Promise<void> {
    invariant(refundCurrencyConfig.length <= 255, "Currency config is too big");
    invariant(addressParameters.length <= 255, "Address parameter is too big.");
    invariant(
      currencyConfigSignature.length >= 70 &&
        currencyConfigSignature.length <= 73,
      "Signature should be DER serialized and have length in [70, 73] bytes."
    );

    const bufferToSend: Buffer = Buffer.concat([
      Buffer.from([refundCurrencyConfig.length]),
      refundCurrencyConfig,
      currencyConfigSignature,
      Buffer.from([addressParameters.length]),
      addressParameters,
    ]);

    let result: Buffer = await this.transport.send(
      0xe0,
      CHECK_REFUND_ADDRESS,
      0x00,
      0x00,
      bufferToSend,
      this.allowedStatuses
    );
    maybeThrowProtocolError(result);
  }

  async signCoinTransaction(transactionType: TransactionType): Promise<void> {
    let result: Buffer = await this.transport.send(
      0xe0,
      SIGN_COIN_TRANSACTION,
      0x00,
      transactionType,
      Buffer.alloc(0),
      this.allowedStatuses
    );
    maybeThrowProtocolError(result);
  }
}
