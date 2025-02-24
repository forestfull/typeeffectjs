function typing(nodeQueryName, contentXML, intervalMilliSeconds) {
    function sleep(milliSeconds) {
        let checkTime = Date.now();
        while (Date.now() - checkTime < milliSeconds) {
        }
    }

    const util = {
        isEmpty: function (firstTagContent) {
            return firstTagContent === null || firstTagContent === undefined || firstTagContent.trim() === '';
        },

        isSingleTag: function (tag) {
            let tagName = tag.split(/\s|>/)[0];
            return tag.indexOf('/>', tag.length - 2) !== -1
                || ['br', 'hr', 'img', 'input'].filter(name => tagName?.toLowerCase()?.indexOf(name) !== -1).length !== 0;
        },

        parsingTagObject: function (tag) {
            let tagObject = {name: undefined, attributeSet: {}, content: []};
            let tagContents = tag.substring(tag.indexOf('<') + 1, tag.lastIndexOf('>'));

            if (tagContents.indexOf('=') === -1) tagObject.name = tagContents?.trim();

            if (tagContents.indexOf('=') !== -1) {
                const tagSpace = tagContents.indexOf(' ');
                tagObject.name = tagContents.substring(0, tagSpace)?.trim();
                tagContents = tagContents.substring(tagSpace)?.trim();

                const valueRegExpSplitter = /=["'`](.*?["'`])/;
                let tagAttributes = tagContents.split(valueRegExpSplitter);
                if (tagAttributes.length % 2 !== 0) tagAttributes.pop();

                for (let i = 0; i < tagAttributes.length; i = i + 2) {
                    const name = tagAttributes[i]?.trim();
                    tagObject.attributeSet[name] = tagAttributes[i + 1]?.replaceAll("\"", '')?.replaceAll("'", '')?.replaceAll("\`", '')?.trim();
                }
            }

            return tagObject;
        },

        substringPrefixTagContent: function (text) {
            const tagPrefix = text.search(/(<\w+)|(<\w+\/>)/);
            return text.substring(tagPrefix, text.indexOf('>', tagPrefix + 1) + 1);
        },

        convertXmlToJSON: function (text) {
            let contentArrays = [];
            let remainString = text?.replaceAll('\n', '')?.replaceAll('\r', '');

            //TIP: 다음 정규식에 해당하는 태그가 있는지 테스트한다.
            while (/(<\w+\/>)/.test(remainString) || /(<\w+)/.test(remainString)) {
                remainString = remainString?.trim();
                const firstTagContent = util.substringPrefixTagContent(remainString);
                if (util.isEmpty(firstTagContent)) break;

                const firstTagIndex = remainString.indexOf(firstTagContent);

                // TIP: 찾게된 'firstTagContent' 변수 앞에 다른 텍스트가 있다면
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

                            //TIP: 태그 없는 생짜 string이면 span태그 임의로 만든다.
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
                for (let name in json.attributeSet)
                    node.setAttribute(name, json.attributeSet[name]);

                if (Array.isArray(json.content) && json.content.length !== 0) {
                    writer.appendObject(node, json.content, interval);
                }

                target.appendChild(node);
            }
        },
        // TIP: 비동기로 실행됨 여러 노드에 드라마틱하게 컨텐츠를 채울 수 있음
        injectContent: function (node, content, interval) {
            let lengthCount = 0;
            const intervalAddress = setInterval(() => {
                if (lengthCount < content.length) {
                    node.innerHTML += content.substring(lengthCount, lengthCount + 1);
                    lengthCount++
                } else {
                    clearInterval(intervalAddress);
                }
            }, interval);
        },
    };

    /************************************START**FUNCTION***LINE************************************/

    const convertedJsonArray = util.convertXmlToJSON(contentXML);
    const targetNode = typeof nodeQueryName === 'object' ? nodeQueryName : document.querySelector(nodeQueryName);

    for (let node of convertedJsonArray) {
        writer.appendObject(targetNode, node, intervalMilliSeconds);
    }
}
