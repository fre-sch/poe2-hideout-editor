export const parseHideout = (text) => {
  let currentChar = 0  // This keeps track of the current character being processed in the JSON string

  const skipWhitespace = () => {
    while (/\s/.test(text[currentChar])) { // (spaces, tabs, newlines)
      currentChar++  // Increment the character pointer to skip the whitespace
    }
  }

  const raiseInvalidError = () => {
    throw new SyntaxError('invalid format')
  }

  const parseObject = (parentKey = null) => {
    let result = (parentKey === "doodads") ? [] : {}

    if (text[currentChar] === '{') {
      currentChar++ // Move past the opening '{'
      skipWhitespace()

      let firstTime = true  // Flag to handle the first property in the object

      while (text[currentChar] !== '}') {  // Keep parsing until the closing brace
        if (!firstTime) {
          if (text[currentChar] === ',') {
            currentChar++ // Skip the comma separating properties
            skipWhitespace()
          } else {
            throw new SyntaxError("Expected ',' between object properties")
          }
        }

        skipWhitespace()

        // Parse the key, which should be a string wrapped in quotes
        if (text[currentChar] !== '"') {
          throw new SyntaxError("Expected string key in object")
        }
        const key = parseString()
        skipWhitespace()

        // Parse the colon separating the key and value
        if (text[currentChar] !== ':') {
          throw new SyntaxError("Expected ':' after key in object")
        }
        currentChar++ // Move past ':'
        skipWhitespace()

        // Parse the value associated with the key
        const value = parseValue(key)
        if (parentKey === "doodads") {
          result.push(
            [key, value]
          )
        }
        else {
          result[key] = value
        }

        skipWhitespace()
        firstTime = false  // After the first property, set this flag to false
      }

      currentChar++ // Move past the closing '}'
      return result
    }
  }

  const parseArray = () => {
    if (text[currentChar] === '[') {
      currentChar++ // Move past the opening '['
      const result = []
      let firstTime = true  // Flag to handle the first element in the array

      while (text[currentChar] !== ']') {  // Keep parsing until the closing bracket
        if (!firstTime) {
          if (text[currentChar] === ',') {
            currentChar++ // Skip the comma separating array elements
          } else {
            raiseInvalidError() // If a comma is missing, it's an invalid array
          }
        }
        skipWhitespace()
        const value = parseValue() // Parse the next value
        if (value === undefined) raiseInvalidError()
        result.push(value)
        firstTime = false  // After the first element, set this flag to false
      }

      currentChar++ // Skip the closing ']'
      return result
    }
  }

  const parseNumber = () => {
    let start = currentChar
    while (
      (text[currentChar] >= '0' && text[currentChar] <= '9') ||
      text[currentChar] === '.' // for decimal
    ) {
      currentChar++ // Move past each digit
    }
    // Convert the string to a number and return
    if (start < currentChar) {
      let result = text.slice(start, currentChar)

      // For the case if result contains only '.'(dot)
      if (!isNaN(result))
        return +result
      raiseInvalidError()
    }
  }

  const parseString = () => {
    if (text[currentChar] === '"') {
      currentChar++ // Move past the opening quote
      let result = ''
      while (text[currentChar] !== '"') {  // Keep reading characters until the closing quote
        result += text[currentChar++]  // Add each character to the result string
      }
      currentChar++ // Skip the closing quote
      return result
    }
  }

  const parseBool = () => {
    if (text.slice(currentChar, currentChar + 4) === 'true') {
      currentChar += 4
      return true
    } else if (text.slice(currentChar, currentChar + 5) === 'false') {
      currentChar += 5
      return false
    }
  }

  const parseNull = () => {
    if (text.slice(currentChar, currentChar + 4) === 'null') {
      currentChar += 4
      return null
    }
  }

  // Function to parse any valid value (string, number, object, array, boolean, or null)
  const parseValue = (parentKey=null) => {
    skipWhitespace()
    const result = (
      parseNumber() ??
      parseString() ??
      parseBool() ??
      parseArray() ??
      parseObject(parentKey) ??
      parseNull()
    )

    return result
  }

  // Start parsing the JSON string by calling parseValue
  return parseValue()
}

export const serializeHideout = (data) => {
  const doodadTextItems = data.doodads.map(([name, doodad]) => {
    const doodadJSON = JSON.stringify(doodad, null, 6)
    return `"${name}": ${doodadJSON}`
  })
  return `{
  "version": ${data.version},
  "language": "${data.language}",
  "hideout_name": "${data.hideout_name}",
  "hideout_hash": ${data.hideout_hash},
  "doodads": {
    ${doodadTextItems.join(",\n    ")}
  }
}`
}
