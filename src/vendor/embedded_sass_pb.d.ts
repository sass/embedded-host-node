// package: 
// file: embedded_sass.proto

import * as jspb from "google-protobuf";

export class InboundMessage extends jspb.Message {
  hasError(): boolean;
  clearError(): void;
  getError(): ProtocolError | undefined;
  setError(value?: ProtocolError): void;

  hasCompilerequest(): boolean;
  clearCompilerequest(): void;
  getCompilerequest(): InboundMessage.CompileRequest | undefined;
  setCompilerequest(value?: InboundMessage.CompileRequest): void;

  hasCanonicalizeresponse(): boolean;
  clearCanonicalizeresponse(): void;
  getCanonicalizeresponse(): InboundMessage.CanonicalizeResponse | undefined;
  setCanonicalizeresponse(value?: InboundMessage.CanonicalizeResponse): void;

  hasImportresponse(): boolean;
  clearImportresponse(): void;
  getImportresponse(): InboundMessage.ImportResponse | undefined;
  setImportresponse(value?: InboundMessage.ImportResponse): void;

  hasFileimportresponse(): boolean;
  clearFileimportresponse(): void;
  getFileimportresponse(): InboundMessage.FileImportResponse | undefined;
  setFileimportresponse(value?: InboundMessage.FileImportResponse): void;

  hasFunctioncallresponse(): boolean;
  clearFunctioncallresponse(): void;
  getFunctioncallresponse(): InboundMessage.FunctionCallResponse | undefined;
  setFunctioncallresponse(value?: InboundMessage.FunctionCallResponse): void;

  getMessageCase(): InboundMessage.MessageCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): InboundMessage.AsObject;
  static toObject(includeInstance: boolean, msg: InboundMessage): InboundMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: InboundMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): InboundMessage;
  static deserializeBinaryFromReader(message: InboundMessage, reader: jspb.BinaryReader): InboundMessage;
}

export namespace InboundMessage {
  export type AsObject = {
    error?: ProtocolError.AsObject,
    compilerequest?: InboundMessage.CompileRequest.AsObject,
    canonicalizeresponse?: InboundMessage.CanonicalizeResponse.AsObject,
    importresponse?: InboundMessage.ImportResponse.AsObject,
    fileimportresponse?: InboundMessage.FileImportResponse.AsObject,
    functioncallresponse?: InboundMessage.FunctionCallResponse.AsObject,
  }

  export class CompileRequest extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasString(): boolean;
    clearString(): void;
    getString(): InboundMessage.CompileRequest.StringInput | undefined;
    setString(value?: InboundMessage.CompileRequest.StringInput): void;

    hasPath(): boolean;
    clearPath(): void;
    getPath(): string;
    setPath(value: string): void;

    getStyle(): InboundMessage.CompileRequest.OutputStyleMap[keyof InboundMessage.CompileRequest.OutputStyleMap];
    setStyle(value: InboundMessage.CompileRequest.OutputStyleMap[keyof InboundMessage.CompileRequest.OutputStyleMap]): void;

    getSourceMap(): boolean;
    setSourceMap(value: boolean): void;

    clearImportersList(): void;
    getImportersList(): Array<InboundMessage.CompileRequest.Importer>;
    setImportersList(value: Array<InboundMessage.CompileRequest.Importer>): void;
    addImporters(value?: InboundMessage.CompileRequest.Importer, index?: number): InboundMessage.CompileRequest.Importer;

    clearGlobalFunctionsList(): void;
    getGlobalFunctionsList(): Array<string>;
    setGlobalFunctionsList(value: Array<string>): void;
    addGlobalFunctions(value: string, index?: number): string;

    getInputCase(): CompileRequest.InputCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CompileRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CompileRequest): CompileRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CompileRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CompileRequest;
    static deserializeBinaryFromReader(message: CompileRequest, reader: jspb.BinaryReader): CompileRequest;
  }

  export namespace CompileRequest {
    export type AsObject = {
      id: number,
      string?: InboundMessage.CompileRequest.StringInput.AsObject,
      path: string,
      style: InboundMessage.CompileRequest.OutputStyleMap[keyof InboundMessage.CompileRequest.OutputStyleMap],
      sourceMap: boolean,
      importersList: Array<InboundMessage.CompileRequest.Importer.AsObject>,
      globalFunctionsList: Array<string>,
    }

    export class StringInput extends jspb.Message {
      getSource(): string;
      setSource(value: string): void;

      getUrl(): string;
      setUrl(value: string): void;

      getSyntax(): InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap];
      setSyntax(value: InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap]): void;

      hasImporter(): boolean;
      clearImporter(): void;
      getImporter(): InboundMessage.CompileRequest.Importer | undefined;
      setImporter(value?: InboundMessage.CompileRequest.Importer): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): StringInput.AsObject;
      static toObject(includeInstance: boolean, msg: StringInput): StringInput.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: StringInput, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): StringInput;
      static deserializeBinaryFromReader(message: StringInput, reader: jspb.BinaryReader): StringInput;
    }

    export namespace StringInput {
      export type AsObject = {
        source: string,
        url: string,
        syntax: InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap],
        importer?: InboundMessage.CompileRequest.Importer.AsObject,
      }
    }

    export class Importer extends jspb.Message {
      hasPath(): boolean;
      clearPath(): void;
      getPath(): string;
      setPath(value: string): void;

      hasImporterId(): boolean;
      clearImporterId(): void;
      getImporterId(): number;
      setImporterId(value: number): void;

      hasFileImporterId(): boolean;
      clearFileImporterId(): void;
      getFileImporterId(): number;
      setFileImporterId(value: number): void;

      getImporterCase(): Importer.ImporterCase;
      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): Importer.AsObject;
      static toObject(includeInstance: boolean, msg: Importer): Importer.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: Importer, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): Importer;
      static deserializeBinaryFromReader(message: Importer, reader: jspb.BinaryReader): Importer;
    }

    export namespace Importer {
      export type AsObject = {
        path: string,
        importerId: number,
        fileImporterId: number,
      }

      export enum ImporterCase {
        IMPORTER_NOT_SET = 0,
        PATH = 1,
        IMPORTER_ID = 2,
        FILE_IMPORTER_ID = 3,
      }
    }

    export interface OutputStyleMap {
      EXPANDED: 0;
      COMPRESSED: 1;
      NESTED: 2;
      COMPACT: 3;
    }

    export const OutputStyle: OutputStyleMap;

    export enum InputCase {
      INPUT_NOT_SET = 0,
      STRING = 2,
      PATH = 3,
    }
  }

  export class CanonicalizeResponse extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasUrl(): boolean;
    clearUrl(): void;
    getUrl(): string;
    setUrl(value: string): void;

    hasError(): boolean;
    clearError(): void;
    getError(): string;
    setError(value: string): void;

    getResultCase(): CanonicalizeResponse.ResultCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CanonicalizeResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CanonicalizeResponse): CanonicalizeResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CanonicalizeResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CanonicalizeResponse;
    static deserializeBinaryFromReader(message: CanonicalizeResponse, reader: jspb.BinaryReader): CanonicalizeResponse;
  }

  export namespace CanonicalizeResponse {
    export type AsObject = {
      id: number,
      url: string,
      error: string,
    }

    export enum ResultCase {
      RESULT_NOT_SET = 0,
      URL = 2,
      ERROR = 3,
    }
  }

  export class ImportResponse extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasSuccess(): boolean;
    clearSuccess(): void;
    getSuccess(): InboundMessage.ImportResponse.ImportSuccess | undefined;
    setSuccess(value?: InboundMessage.ImportResponse.ImportSuccess): void;

    hasError(): boolean;
    clearError(): void;
    getError(): string;
    setError(value: string): void;

    getResultCase(): ImportResponse.ResultCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ImportResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ImportResponse): ImportResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ImportResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ImportResponse;
    static deserializeBinaryFromReader(message: ImportResponse, reader: jspb.BinaryReader): ImportResponse;
  }

  export namespace ImportResponse {
    export type AsObject = {
      id: number,
      success?: InboundMessage.ImportResponse.ImportSuccess.AsObject,
      error: string,
    }

    export class ImportSuccess extends jspb.Message {
      getContents(): string;
      setContents(value: string): void;

      getSyntax(): InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap];
      setSyntax(value: InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap]): void;

      getSourcemapurl(): string;
      setSourcemapurl(value: string): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): ImportSuccess.AsObject;
      static toObject(includeInstance: boolean, msg: ImportSuccess): ImportSuccess.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: ImportSuccess, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): ImportSuccess;
      static deserializeBinaryFromReader(message: ImportSuccess, reader: jspb.BinaryReader): ImportSuccess;
    }

    export namespace ImportSuccess {
      export type AsObject = {
        contents: string,
        syntax: InboundMessage.SyntaxMap[keyof InboundMessage.SyntaxMap],
        sourcemapurl: string,
      }
    }

    export enum ResultCase {
      RESULT_NOT_SET = 0,
      SUCCESS = 2,
      ERROR = 3,
    }
  }

  export class FileImportResponse extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasFileUrl(): boolean;
    clearFileUrl(): void;
    getFileUrl(): string;
    setFileUrl(value: string): void;

    hasError(): boolean;
    clearError(): void;
    getError(): string;
    setError(value: string): void;

    getResultCase(): FileImportResponse.ResultCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): FileImportResponse.AsObject;
    static toObject(includeInstance: boolean, msg: FileImportResponse): FileImportResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: FileImportResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): FileImportResponse;
    static deserializeBinaryFromReader(message: FileImportResponse, reader: jspb.BinaryReader): FileImportResponse;
  }

  export namespace FileImportResponse {
    export type AsObject = {
      id: number,
      fileUrl: string,
      error: string,
    }

    export enum ResultCase {
      RESULT_NOT_SET = 0,
      FILE_URL = 2,
      ERROR = 3,
    }
  }

  export class FunctionCallResponse extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasSuccess(): boolean;
    clearSuccess(): void;
    getSuccess(): Value | undefined;
    setSuccess(value?: Value): void;

    hasError(): boolean;
    clearError(): void;
    getError(): string;
    setError(value: string): void;

    getResultCase(): FunctionCallResponse.ResultCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): FunctionCallResponse.AsObject;
    static toObject(includeInstance: boolean, msg: FunctionCallResponse): FunctionCallResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: FunctionCallResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): FunctionCallResponse;
    static deserializeBinaryFromReader(message: FunctionCallResponse, reader: jspb.BinaryReader): FunctionCallResponse;
  }

  export namespace FunctionCallResponse {
    export type AsObject = {
      id: number,
      success?: Value.AsObject,
      error: string,
    }

    export enum ResultCase {
      RESULT_NOT_SET = 0,
      SUCCESS = 2,
      ERROR = 3,
    }
  }

  export interface SyntaxMap {
    SCSS: 0;
    INDENTED: 1;
    CSS: 2;
  }

  export const Syntax: SyntaxMap;

  export enum MessageCase {
    MESSAGE_NOT_SET = 0,
    ERROR = 1,
    COMPILEREQUEST = 2,
    CANONICALIZERESPONSE = 3,
    IMPORTRESPONSE = 4,
    FILEIMPORTRESPONSE = 5,
    FUNCTIONCALLRESPONSE = 6,
  }
}

export class OutboundMessage extends jspb.Message {
  hasError(): boolean;
  clearError(): void;
  getError(): ProtocolError | undefined;
  setError(value?: ProtocolError): void;

  hasCompileresponse(): boolean;
  clearCompileresponse(): void;
  getCompileresponse(): OutboundMessage.CompileResponse | undefined;
  setCompileresponse(value?: OutboundMessage.CompileResponse): void;

  hasLogevent(): boolean;
  clearLogevent(): void;
  getLogevent(): OutboundMessage.LogEvent | undefined;
  setLogevent(value?: OutboundMessage.LogEvent): void;

  hasCanonicalizerequest(): boolean;
  clearCanonicalizerequest(): void;
  getCanonicalizerequest(): OutboundMessage.CanonicalizeRequest | undefined;
  setCanonicalizerequest(value?: OutboundMessage.CanonicalizeRequest): void;

  hasImportrequest(): boolean;
  clearImportrequest(): void;
  getImportrequest(): OutboundMessage.ImportRequest | undefined;
  setImportrequest(value?: OutboundMessage.ImportRequest): void;

  hasFileimportrequest(): boolean;
  clearFileimportrequest(): void;
  getFileimportrequest(): OutboundMessage.FileImportRequest | undefined;
  setFileimportrequest(value?: OutboundMessage.FileImportRequest): void;

  hasFunctioncallrequest(): boolean;
  clearFunctioncallrequest(): void;
  getFunctioncallrequest(): OutboundMessage.FunctionCallRequest | undefined;
  setFunctioncallrequest(value?: OutboundMessage.FunctionCallRequest): void;

  getMessageCase(): OutboundMessage.MessageCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): OutboundMessage.AsObject;
  static toObject(includeInstance: boolean, msg: OutboundMessage): OutboundMessage.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: OutboundMessage, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): OutboundMessage;
  static deserializeBinaryFromReader(message: OutboundMessage, reader: jspb.BinaryReader): OutboundMessage;
}

export namespace OutboundMessage {
  export type AsObject = {
    error?: ProtocolError.AsObject,
    compileresponse?: OutboundMessage.CompileResponse.AsObject,
    logevent?: OutboundMessage.LogEvent.AsObject,
    canonicalizerequest?: OutboundMessage.CanonicalizeRequest.AsObject,
    importrequest?: OutboundMessage.ImportRequest.AsObject,
    fileimportrequest?: OutboundMessage.FileImportRequest.AsObject,
    functioncallrequest?: OutboundMessage.FunctionCallRequest.AsObject,
  }

  export class CompileResponse extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    hasSuccess(): boolean;
    clearSuccess(): void;
    getSuccess(): OutboundMessage.CompileResponse.CompileSuccess | undefined;
    setSuccess(value?: OutboundMessage.CompileResponse.CompileSuccess): void;

    hasFailure(): boolean;
    clearFailure(): void;
    getFailure(): OutboundMessage.CompileResponse.CompileFailure | undefined;
    setFailure(value?: OutboundMessage.CompileResponse.CompileFailure): void;

    getResultCase(): CompileResponse.ResultCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CompileResponse.AsObject;
    static toObject(includeInstance: boolean, msg: CompileResponse): CompileResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CompileResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CompileResponse;
    static deserializeBinaryFromReader(message: CompileResponse, reader: jspb.BinaryReader): CompileResponse;
  }

  export namespace CompileResponse {
    export type AsObject = {
      id: number,
      success?: OutboundMessage.CompileResponse.CompileSuccess.AsObject,
      failure?: OutboundMessage.CompileResponse.CompileFailure.AsObject,
    }

    export class CompileSuccess extends jspb.Message {
      getCss(): string;
      setCss(value: string): void;

      getSourceMap(): string;
      setSourceMap(value: string): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): CompileSuccess.AsObject;
      static toObject(includeInstance: boolean, msg: CompileSuccess): CompileSuccess.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: CompileSuccess, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): CompileSuccess;
      static deserializeBinaryFromReader(message: CompileSuccess, reader: jspb.BinaryReader): CompileSuccess;
    }

    export namespace CompileSuccess {
      export type AsObject = {
        css: string,
        sourceMap: string,
      }
    }

    export class CompileFailure extends jspb.Message {
      getMessage(): string;
      setMessage(value: string): void;

      hasSpan(): boolean;
      clearSpan(): void;
      getSpan(): SourceSpan | undefined;
      setSpan(value?: SourceSpan): void;

      getStackTrace(): string;
      setStackTrace(value: string): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): CompileFailure.AsObject;
      static toObject(includeInstance: boolean, msg: CompileFailure): CompileFailure.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: CompileFailure, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): CompileFailure;
      static deserializeBinaryFromReader(message: CompileFailure, reader: jspb.BinaryReader): CompileFailure;
    }

    export namespace CompileFailure {
      export type AsObject = {
        message: string,
        span?: SourceSpan.AsObject,
        stackTrace: string,
      }
    }

    export enum ResultCase {
      RESULT_NOT_SET = 0,
      SUCCESS = 2,
      FAILURE = 3,
    }
  }

  export class LogEvent extends jspb.Message {
    getCompilationId(): number;
    setCompilationId(value: number): void;

    getType(): OutboundMessage.LogEvent.TypeMap[keyof OutboundMessage.LogEvent.TypeMap];
    setType(value: OutboundMessage.LogEvent.TypeMap[keyof OutboundMessage.LogEvent.TypeMap]): void;

    getMessage(): string;
    setMessage(value: string): void;

    hasSpan(): boolean;
    clearSpan(): void;
    getSpan(): SourceSpan | undefined;
    setSpan(value?: SourceSpan): void;

    getStackTrace(): string;
    setStackTrace(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): LogEvent.AsObject;
    static toObject(includeInstance: boolean, msg: LogEvent): LogEvent.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: LogEvent, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): LogEvent;
    static deserializeBinaryFromReader(message: LogEvent, reader: jspb.BinaryReader): LogEvent;
  }

  export namespace LogEvent {
    export type AsObject = {
      compilationId: number,
      type: OutboundMessage.LogEvent.TypeMap[keyof OutboundMessage.LogEvent.TypeMap],
      message: string,
      span?: SourceSpan.AsObject,
      stackTrace: string,
    }

    export interface TypeMap {
      WARNING: 0;
      DEPRECATION_WARNING: 1;
      DEBUG: 2;
    }

    export const Type: TypeMap;
  }

  export class CanonicalizeRequest extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    getCompilationId(): number;
    setCompilationId(value: number): void;

    getImporterId(): number;
    setImporterId(value: number): void;

    getUrl(): string;
    setUrl(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CanonicalizeRequest.AsObject;
    static toObject(includeInstance: boolean, msg: CanonicalizeRequest): CanonicalizeRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CanonicalizeRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CanonicalizeRequest;
    static deserializeBinaryFromReader(message: CanonicalizeRequest, reader: jspb.BinaryReader): CanonicalizeRequest;
  }

  export namespace CanonicalizeRequest {
    export type AsObject = {
      id: number,
      compilationId: number,
      importerId: number,
      url: string,
    }
  }

  export class ImportRequest extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    getCompilationId(): number;
    setCompilationId(value: number): void;

    getImporterId(): number;
    setImporterId(value: number): void;

    getUrl(): string;
    setUrl(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ImportRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ImportRequest): ImportRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ImportRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ImportRequest;
    static deserializeBinaryFromReader(message: ImportRequest, reader: jspb.BinaryReader): ImportRequest;
  }

  export namespace ImportRequest {
    export type AsObject = {
      id: number,
      compilationId: number,
      importerId: number,
      url: string,
    }
  }

  export class FileImportRequest extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    getCompilationId(): number;
    setCompilationId(value: number): void;

    getImporterId(): number;
    setImporterId(value: number): void;

    getUrl(): string;
    setUrl(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): FileImportRequest.AsObject;
    static toObject(includeInstance: boolean, msg: FileImportRequest): FileImportRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: FileImportRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): FileImportRequest;
    static deserializeBinaryFromReader(message: FileImportRequest, reader: jspb.BinaryReader): FileImportRequest;
  }

  export namespace FileImportRequest {
    export type AsObject = {
      id: number,
      compilationId: number,
      importerId: number,
      url: string,
    }
  }

  export class FunctionCallRequest extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    getCompilationId(): number;
    setCompilationId(value: number): void;

    hasName(): boolean;
    clearName(): void;
    getName(): string;
    setName(value: string): void;

    hasFunctionId(): boolean;
    clearFunctionId(): void;
    getFunctionId(): number;
    setFunctionId(value: number): void;

    clearArgumentsList(): void;
    getArgumentsList(): Array<Value>;
    setArgumentsList(value: Array<Value>): void;
    addArguments(value?: Value, index?: number): Value;

    getIdentifierCase(): FunctionCallRequest.IdentifierCase;
    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): FunctionCallRequest.AsObject;
    static toObject(includeInstance: boolean, msg: FunctionCallRequest): FunctionCallRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: FunctionCallRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): FunctionCallRequest;
    static deserializeBinaryFromReader(message: FunctionCallRequest, reader: jspb.BinaryReader): FunctionCallRequest;
  }

  export namespace FunctionCallRequest {
    export type AsObject = {
      id: number,
      compilationId: number,
      name: string,
      functionId: number,
      argumentsList: Array<Value.AsObject>,
    }

    export enum IdentifierCase {
      IDENTIFIER_NOT_SET = 0,
      NAME = 3,
      FUNCTION_ID = 4,
    }
  }

  export enum MessageCase {
    MESSAGE_NOT_SET = 0,
    ERROR = 1,
    COMPILERESPONSE = 2,
    LOGEVENT = 3,
    CANONICALIZEREQUEST = 4,
    IMPORTREQUEST = 5,
    FILEIMPORTREQUEST = 6,
    FUNCTIONCALLREQUEST = 7,
  }
}

export class ProtocolError extends jspb.Message {
  getType(): ProtocolError.ErrorTypeMap[keyof ProtocolError.ErrorTypeMap];
  setType(value: ProtocolError.ErrorTypeMap[keyof ProtocolError.ErrorTypeMap]): void;

  getId(): number;
  setId(value: number): void;

  getMessage(): string;
  setMessage(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ProtocolError.AsObject;
  static toObject(includeInstance: boolean, msg: ProtocolError): ProtocolError.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ProtocolError, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ProtocolError;
  static deserializeBinaryFromReader(message: ProtocolError, reader: jspb.BinaryReader): ProtocolError;
}

export namespace ProtocolError {
  export type AsObject = {
    type: ProtocolError.ErrorTypeMap[keyof ProtocolError.ErrorTypeMap],
    id: number,
    message: string,
  }

  export interface ErrorTypeMap {
    PARSE: 0;
    PARAMS: 1;
    INTERNAL: 2;
  }

  export const ErrorType: ErrorTypeMap;
}

export class SourceSpan extends jspb.Message {
  getText(): string;
  setText(value: string): void;

  hasStart(): boolean;
  clearStart(): void;
  getStart(): SourceSpan.SourceLocation | undefined;
  setStart(value?: SourceSpan.SourceLocation): void;

  hasEnd(): boolean;
  clearEnd(): void;
  getEnd(): SourceSpan.SourceLocation | undefined;
  setEnd(value?: SourceSpan.SourceLocation): void;

  getUrl(): string;
  setUrl(value: string): void;

  getContext(): string;
  setContext(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SourceSpan.AsObject;
  static toObject(includeInstance: boolean, msg: SourceSpan): SourceSpan.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SourceSpan, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SourceSpan;
  static deserializeBinaryFromReader(message: SourceSpan, reader: jspb.BinaryReader): SourceSpan;
}

export namespace SourceSpan {
  export type AsObject = {
    text: string,
    start?: SourceSpan.SourceLocation.AsObject,
    end?: SourceSpan.SourceLocation.AsObject,
    url: string,
    context: string,
  }

  export class SourceLocation extends jspb.Message {
    getOffset(): number;
    setOffset(value: number): void;

    getLine(): number;
    setLine(value: number): void;

    getColumn(): number;
    setColumn(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): SourceLocation.AsObject;
    static toObject(includeInstance: boolean, msg: SourceLocation): SourceLocation.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: SourceLocation, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): SourceLocation;
    static deserializeBinaryFromReader(message: SourceLocation, reader: jspb.BinaryReader): SourceLocation;
  }

  export namespace SourceLocation {
    export type AsObject = {
      offset: number,
      line: number,
      column: number,
    }
  }
}

export class Value extends jspb.Message {
  hasString(): boolean;
  clearString(): void;
  getString(): Value.String | undefined;
  setString(value?: Value.String): void;

  hasNumber(): boolean;
  clearNumber(): void;
  getNumber(): Value.Number | undefined;
  setNumber(value?: Value.Number): void;

  hasRgbColor(): boolean;
  clearRgbColor(): void;
  getRgbColor(): Value.RgbColor | undefined;
  setRgbColor(value?: Value.RgbColor): void;

  hasHslColor(): boolean;
  clearHslColor(): void;
  getHslColor(): Value.HslColor | undefined;
  setHslColor(value?: Value.HslColor): void;

  hasList(): boolean;
  clearList(): void;
  getList(): Value.List | undefined;
  setList(value?: Value.List): void;

  hasMap(): boolean;
  clearMap(): void;
  getMap(): Value.Map | undefined;
  setMap(value?: Value.Map): void;

  hasSingleton(): boolean;
  clearSingleton(): void;
  getSingleton(): Value.SingletonMap[keyof Value.SingletonMap];
  setSingleton(value: Value.SingletonMap[keyof Value.SingletonMap]): void;

  hasCompilerFunction(): boolean;
  clearCompilerFunction(): void;
  getCompilerFunction(): Value.CompilerFunction | undefined;
  setCompilerFunction(value?: Value.CompilerFunction): void;

  hasHostFunction(): boolean;
  clearHostFunction(): void;
  getHostFunction(): Value.HostFunction | undefined;
  setHostFunction(value?: Value.HostFunction): void;

  getValueCase(): Value.ValueCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Value.AsObject;
  static toObject(includeInstance: boolean, msg: Value): Value.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Value, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Value;
  static deserializeBinaryFromReader(message: Value, reader: jspb.BinaryReader): Value;
}

export namespace Value {
  export type AsObject = {
    string?: Value.String.AsObject,
    number?: Value.Number.AsObject,
    rgbColor?: Value.RgbColor.AsObject,
    hslColor?: Value.HslColor.AsObject,
    list?: Value.List.AsObject,
    map?: Value.Map.AsObject,
    singleton: Value.SingletonMap[keyof Value.SingletonMap],
    compilerFunction?: Value.CompilerFunction.AsObject,
    hostFunction?: Value.HostFunction.AsObject,
  }

  export class String extends jspb.Message {
    getText(): string;
    setText(value: string): void;

    getQuoted(): boolean;
    setQuoted(value: boolean): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): String.AsObject;
    static toObject(includeInstance: boolean, msg: String): String.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: String, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): String;
    static deserializeBinaryFromReader(message: String, reader: jspb.BinaryReader): String;
  }

  export namespace String {
    export type AsObject = {
      text: string,
      quoted: boolean,
    }
  }

  export class Number extends jspb.Message {
    getValue(): number;
    setValue(value: number): void;

    clearNumeratorsList(): void;
    getNumeratorsList(): Array<string>;
    setNumeratorsList(value: Array<string>): void;
    addNumerators(value: string, index?: number): string;

    clearDenominatorsList(): void;
    getDenominatorsList(): Array<string>;
    setDenominatorsList(value: Array<string>): void;
    addDenominators(value: string, index?: number): string;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Number.AsObject;
    static toObject(includeInstance: boolean, msg: Number): Number.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Number, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Number;
    static deserializeBinaryFromReader(message: Number, reader: jspb.BinaryReader): Number;
  }

  export namespace Number {
    export type AsObject = {
      value: number,
      numeratorsList: Array<string>,
      denominatorsList: Array<string>,
    }
  }

  export class RgbColor extends jspb.Message {
    getRed(): number;
    setRed(value: number): void;

    getGreen(): number;
    setGreen(value: number): void;

    getBlue(): number;
    setBlue(value: number): void;

    getAlpha(): number;
    setAlpha(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): RgbColor.AsObject;
    static toObject(includeInstance: boolean, msg: RgbColor): RgbColor.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: RgbColor, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): RgbColor;
    static deserializeBinaryFromReader(message: RgbColor, reader: jspb.BinaryReader): RgbColor;
  }

  export namespace RgbColor {
    export type AsObject = {
      red: number,
      green: number,
      blue: number,
      alpha: number,
    }
  }

  export class HslColor extends jspb.Message {
    getHue(): number;
    setHue(value: number): void;

    getSaturation(): number;
    setSaturation(value: number): void;

    getLightness(): number;
    setLightness(value: number): void;

    getAlpha(): number;
    setAlpha(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): HslColor.AsObject;
    static toObject(includeInstance: boolean, msg: HslColor): HslColor.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: HslColor, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): HslColor;
    static deserializeBinaryFromReader(message: HslColor, reader: jspb.BinaryReader): HslColor;
  }

  export namespace HslColor {
    export type AsObject = {
      hue: number,
      saturation: number,
      lightness: number,
      alpha: number,
    }
  }

  export class List extends jspb.Message {
    getSeparator(): Value.List.SeparatorMap[keyof Value.List.SeparatorMap];
    setSeparator(value: Value.List.SeparatorMap[keyof Value.List.SeparatorMap]): void;

    getHasBrackets(): boolean;
    setHasBrackets(value: boolean): void;

    clearContentsList(): void;
    getContentsList(): Array<Value>;
    setContentsList(value: Array<Value>): void;
    addContents(value?: Value, index?: number): Value;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): List.AsObject;
    static toObject(includeInstance: boolean, msg: List): List.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: List, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): List;
    static deserializeBinaryFromReader(message: List, reader: jspb.BinaryReader): List;
  }

  export namespace List {
    export type AsObject = {
      separator: Value.List.SeparatorMap[keyof Value.List.SeparatorMap],
      hasBrackets: boolean,
      contentsList: Array<Value.AsObject>,
    }

    export interface SeparatorMap {
      COMMA: 0;
      SPACE: 1;
      SLASH: 2;
      UNDECIDED: 3;
    }

    export const Separator: SeparatorMap;
  }

  export class Map extends jspb.Message {
    clearEntriesList(): void;
    getEntriesList(): Array<Value.Map.Entry>;
    setEntriesList(value: Array<Value.Map.Entry>): void;
    addEntries(value?: Value.Map.Entry, index?: number): Value.Map.Entry;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Map.AsObject;
    static toObject(includeInstance: boolean, msg: Map): Map.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Map, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Map;
    static deserializeBinaryFromReader(message: Map, reader: jspb.BinaryReader): Map;
  }

  export namespace Map {
    export type AsObject = {
      entriesList: Array<Value.Map.Entry.AsObject>,
    }

    export class Entry extends jspb.Message {
      hasKey(): boolean;
      clearKey(): void;
      getKey(): Value | undefined;
      setKey(value?: Value): void;

      hasValue(): boolean;
      clearValue(): void;
      getValue(): Value | undefined;
      setValue(value?: Value): void;

      serializeBinary(): Uint8Array;
      toObject(includeInstance?: boolean): Entry.AsObject;
      static toObject(includeInstance: boolean, msg: Entry): Entry.AsObject;
      static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
      static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
      static serializeBinaryToWriter(message: Entry, writer: jspb.BinaryWriter): void;
      static deserializeBinary(bytes: Uint8Array): Entry;
      static deserializeBinaryFromReader(message: Entry, reader: jspb.BinaryReader): Entry;
    }

    export namespace Entry {
      export type AsObject = {
        key?: Value.AsObject,
        value?: Value.AsObject,
      }
    }
  }

  export class CompilerFunction extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): CompilerFunction.AsObject;
    static toObject(includeInstance: boolean, msg: CompilerFunction): CompilerFunction.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: CompilerFunction, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): CompilerFunction;
    static deserializeBinaryFromReader(message: CompilerFunction, reader: jspb.BinaryReader): CompilerFunction;
  }

  export namespace CompilerFunction {
    export type AsObject = {
      id: number,
    }
  }

  export class HostFunction extends jspb.Message {
    getId(): number;
    setId(value: number): void;

    getSignature(): string;
    setSignature(value: string): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): HostFunction.AsObject;
    static toObject(includeInstance: boolean, msg: HostFunction): HostFunction.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: HostFunction, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): HostFunction;
    static deserializeBinaryFromReader(message: HostFunction, reader: jspb.BinaryReader): HostFunction;
  }

  export namespace HostFunction {
    export type AsObject = {
      id: number,
      signature: string,
    }
  }

  export interface SingletonMap {
    TRUE: 0;
    FALSE: 1;
    NULL: 2;
  }

  export const Singleton: SingletonMap;

  export enum ValueCase {
    VALUE_NOT_SET = 0,
    STRING = 1,
    NUMBER = 2,
    RGB_COLOR = 3,
    HSL_COLOR = 4,
    LIST = 5,
    MAP = 6,
    SINGLETON = 7,
    COMPILER_FUNCTION = 8,
    HOST_FUNCTION = 9,
  }
}

