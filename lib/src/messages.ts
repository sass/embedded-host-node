// Copyright 2023 Google Inc. Use of this source code is governed by an
// MIT-style license that can be found in the LICENSE file or at
// https://opensource.org/licenses/MIT.

import {
  InboundMessage,
  OutboundMessage,
} from './vendor/embedded-protocol/embedded_sass_pb';

// Given a message type `M` (either `InboundMessage` or `OutboundMessage`) and a
// union of possible message cases `T`, returns all the child types `M` contains
// whose cases match `T`.
type MessagesOfType<M extends {message: {case: unknown}}, T> = (M & {
  message: {case: T; value: unknown};
})['message']['value'];

/**
 * The names of inbound messages that are requests from the host to the
 * compiler.
 */
export type InboundRequestType = 'compileRequest';

/** Inbound messages that are requests from the host to the compiler. */
export type InboundRequest = MessagesOfType<InboundMessage, InboundRequestType>;

/**
 * The names of inbound of messages that are responses to `OutboundRequest`s.
 */
export type InboundResponseType =
  | 'importResponse'
  | 'fileImportResponse'
  | 'canonicalizeResponse'
  | 'functionCallResponse';

/** Inbound messages that are responses to `OutboundRequest`s. */
export type InboundResponse = MessagesOfType<
  InboundMessage,
  InboundResponseType
>;

/**
 * The names of outbound messages that are requests from the host to the
 * compiler.
 */
export type OutboundRequestType =
  | 'importRequest'
  | 'fileImportRequest'
  | 'canonicalizeRequest'
  | 'functionCallRequest';

/** Outbound messages that are requests from the host to the compiler. */
export type OutboundRequest = MessagesOfType<
  OutboundMessage,
  OutboundRequestType
>;

/** The names of inbound messages that are responses to `InboundRequest`s. */
export type OutboundResponseType = 'compileResponse';

/** Inbound messages that are responses to `InboundRequest`s. */
export type OutboundResponse = MessagesOfType<
  OutboundMessage,
  OutboundResponseType
>;

/** The names of outbound messages that don't require responses. */
export type OutboundEventType = 'logEvent';

/** Outbound messages that don't require responses. */
export type OutboundEvent = MessagesOfType<OutboundMessage, OutboundEventType>;
