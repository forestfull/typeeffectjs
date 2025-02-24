/**
 * Creates a typing effect by parsing XML content and appending it to a DOM node
 * @param {string|Object} nodeQueryName - Target DOM node or selector string
 * @param {string} contentXML - XML content to be parsed and displayed
 * @param {number} intervalMilliSeconds - Interval between character additions in milliseconds
 */
function typing(nodeQueryName, contentXML, intervalMilliSeconds) {
    const util = {
        // Checks if content is empty
        // (내용이 비어있는지 확인)
        isEmpty: function (firstTagContent) {
            return firstTagContent === null || firstTagContent === undefined || firstTagContent.trim() === '';
        },

        // Determines if a tag is a single/self-closing tag
        // (태그가 단일/자체 닫힘 태그인지 판단)
        isSingleTag: function (tag) {
            let tagName = tag.split(/\s|>/)[0];
            return tag.indexOf('/>', tag.length - 2) !== -1 ||
                ['br', 'hr', 'img', 'input'].filter(name => tagName?.toLowerCase()?.indexOf(name) !== -1).length !== 0;
        },

        // Parses tag into an object with name, attributes, and content
        // (태그를 이름, 속성, 내용이 있는 객체로 파싱)
        parsingTagObject: function (tag) {
            let tagObject = {name: undefined, attributeSet: {}, content: []};
            let tagContents = tag.substring(tag.indexOf('<') + 1, tag.lastIndexOf('>'));

            if (tagContents.indexOf('=') === -1) tagObject.name = tagContents?.trim();
            if (tagContents.indexOf('=') !== -1) {
                const tagSpace = tagContents.indexOf(' ');
                tagObject.name = tagContents.substring(0, tagSpace)?.trim();
                tagContents = tagContents.substring(tagSpace)?.trim();

                const valueRegExpSplitter = /(["'`])(.*?)\1/;
                let tagAttributes = tagContents.split(valueRegExpSplitter);
                tagAttributes = tagAttributes.filter(attribute => attribute !== '"' && attribute !== '\'' &&
                    attribute !== '`' && attribute !== undefined && attribute !== null && attribute !== '');

                for (let i = 0; i < tagAttributes.length; i = i + 2) {
                    let name = tagAttributes[i]?.trim();
                    if (name.indexOf('=') === -1) continue;
                    name = name.replaceAll('=', '');
                    tagObject.attributeSet[name] = tagAttributes[i + 1]?.trim();
                }
            }
            return tagObject;
        },

        // Extracts the first tag from text
        // (텍스트에서 첫 번째 태그 추출)
        substringPrefixTagContent: function (text) {
            const tagPrefix = text.search(/(<\w+)|(<\w+\/>)/);
            return text.substring(tagPrefix, text.indexOf('>', tagPrefix + 1) + 1);
        },

        // Converts XML string to JSON structure
        // (XML 문자열을 JSON 구조로 변환)
        convertXmlToJSON: function (text) {
            let contentArrays = [];
            let remainString = text?.replaceAll('\n', '')?.replaceAll('\r', '');

            while (/(<\w+\/>)/.test(remainString) || /(<\w+)/.test(remainString)) {
                remainString = remainString?.trim();
                const firstTagContent = util.substringPrefixTagContent(remainString);
                if (util.isEmpty(firstTagContent)) break;

                const firstTagIndex = remainString.indexOf(firstTagContent);
                if (firstTagIndex !== 0) {
                    const beforeText = remainString.substring(0, firstTagIndex);
                    contentArrays.push(beforeText);
                    remainString = remainString.replace(beforeText, '');
                }

                let tag = util.parsingTagObject(firstTagContent);
                if (util.isSingleTag(firstTagContent)) {
                    contentArrays.push(tag);
                    remainString = remainString.replace(firstTagContent, '');
                    continue;
                }

                const startTagString = '<' + tag.name;
                const endTagString = '</' + tag.name + '>';
                let endTagIndex = remainString.indexOf(endTagString);
                let tagContent = remainString.substring(firstTagContent.length, endTagIndex);

                let startTagCount = tagContent.split(startTagString).length - 1;
                let endTagCount = tagContent.split(endTagString).length - 1;

                while (startTagCount > endTagCount) {
                    endTagIndex = remainString.indexOf(endTagString, endTagIndex + 1);
                    tagContent = remainString.substring(firstTagContent.length, endTagIndex);
                    startTagCount = tagContent.split(startTagString).length - 1;
                    endTagCount = tagContent.split(endTagString).length - 1;
                }

                if (util.isEmpty(tagContent) || tag.name?.toLowerCase() === 'script') {
                    tag.content = tagContent;
                } else {
                    tag.content = util.convertXmlToJSON(tagContent);
                }
                remainString = remainString.substring(endTagIndex + endTagString.length);
                contentArrays.push(tag);
            }

            if (!util.isEmpty(remainString)) contentArrays.push(remainString);
            return contentArrays;
        }
    };

    const writer = {
        // Appends parsed objects to target node
        // (파싱된 객체를 대상 노드에 추가)
        appendObject: function (target, json, interval) {
            if (Array.isArray(json) && json.length !== 0) {
                if (json.length === 1) {
                    if (typeof json[0] === 'string') {
                        writer.injectContent(target, json[0], interval);
                    } else {
                        writer.appendObject(target, json[0], interval);
                    }
                } else {
                    for (let element of json) {
                        if (typeof element === 'string') {
                            if (util.isEmpty(element?.trim())) continue;
                            const tempSpan = document.createElement('span');
                            tempSpan.id = 'typing-tmp-' + Date.now();
                            target.appendChild(tempSpan);
                            writer.injectContent(tempSpan, element, interval);
                        } else {
                            writer.appendObject(target, element, interval);
                        }
                    }
                }
            } else if (json.name === undefined) {
                writer.injectContent(target, json, interval);
            } else if (json.name === 'script') {
                const scriptElement = document.createElement("script");
                scriptElement.innerHTML = json.content;
                target.appendChild(scriptElement);
            } else {
                const node = document.createElement(json.name);
                for (let name in json.attributeSet) node.setAttribute(name, json.attributeSet[name]);
                if (Array.isArray(json.content) && json.content.length !== 0) {
                    writer.appendObject(node, json.content, interval);
                }
                target.appendChild(node);
            }
        },

        // Injects content with typing animation
        // (타이핑 애니메이션으로 내용 주입)
        injectContent: function (node, content, interval) {
            let lengthCount = 0;
            const intervalAddress = setInterval(() => {
                if (lengthCount < content.length) {
                    node.innerHTML += content.substring(lengthCount, lengthCount + 1);
                    lengthCount++;
                } else {
                    clearInterval(intervalAddress);
                }
            }, interval);
        },
    };

    // Main execution
    // (주 실행부)
    const convertedJsonArray = util.convertXmlToJSON(contentXML);
    const targetNode = typeof nodeQueryName === 'object' ? nodeQueryName : document.querySelector(nodeQueryName);

    for (let node of convertedJsonArray) {
        writer.appendObject(targetNode, node, intervalMilliSeconds);
    }
}