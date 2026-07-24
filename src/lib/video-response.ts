export function parseByteRange(header:string|null,size:number) {
  const match=header?.match(/^bytes=(\d*)-(\d*)$/); if(!match)return null;
  let start=match[1]?Number(match[1]):0; let end=match[2]?Number(match[2]):size-1;
  if(!match[1]&&match[2]){const suffix=Number(match[2]);start=Math.max(0,size-suffix);end=size-1}
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=size)return null;
  return {start,end:Math.min(end,size-1)};
}

export function videoResponse(body:Buffer,request:Request,contentType="video/mp4") {
  const headers={"content-type":contentType,"cache-control":"private, max-age=600","accept-ranges":"bytes"};
  const requested=request.headers.get("range"); const range=parseByteRange(requested,body.length);
  if(requested&&!range)return new Response(null,{status:416,headers:{...headers,"content-range":`bytes */${body.length}`}});
  if(!range)return new Response(Uint8Array.from(body),{headers:{...headers,"content-length":String(body.length)}});
  const chunk=body.subarray(range.start,range.end+1);
  return new Response(Uint8Array.from(chunk),{status:206,headers:{...headers,"content-length":String(chunk.length),"content-range":`bytes ${range.start}-${range.end}/${body.length}`}});
}
