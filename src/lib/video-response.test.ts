import { describe,expect,it } from "vitest";
import { parseByteRange } from "./video-response";

describe("video byte ranges",()=>{
  it("parses bounded and open-ended ranges",()=>{expect(parseByteRange("bytes=10-19",100)).toEqual({start:10,end:19});expect(parseByteRange("bytes=90-",100)).toEqual({start:90,end:99})});
  it("parses suffix ranges",()=>expect(parseByteRange("bytes=-10",100)).toEqual({start:90,end:99}));
  it("rejects ranges outside the file",()=>expect(parseByteRange("bytes=100-120",100)).toBeNull());
});
