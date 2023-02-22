export const ndjsonParse = async function* (stream) {
  const matcher = /\r?\n/
  const decoder = new TextDecoder('utf8')
  let buffer = ''

  for await (let value of stream) {
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(matcher)
    buffer = parts.pop() || ''
    for (const part of parts) yield JSON.parse(part)
  }
  buffer += decoder.decode(undefined, { stream: false })
  if (buffer) yield JSON.parse(buffer)
}


export async function* streamResponse(stream) {
    // const response = await Axios.get("http://localhost:9094/pins", {
    //     responseType: 'stream',
    //     timeout: 6000000,
    // })

    // const stream = response.data;


    for await (let json of ndjsonParse(stream)) {
        try {
            // const json = JSON.parse(jsonData.toString())
            yield json;
        } catch(ex) {
            console.log(ex)
            // console.log(jsonData.toString())
            //End
        }
    }
}