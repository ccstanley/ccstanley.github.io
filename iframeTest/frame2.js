function getResponse() {
  return fetch(
    "https://odb.outbrain.com/utils/platforms?bundleUrl=https://webstore.kaiostech.com/apps?bundle_id=com.opera.app.news&widgetJSId=APP_2&format=vjnc&idx=0&secured=true&key=KAIOSGBMO2M11IHAJ2IK3IFM7&api_user_id=9ac91c17-e72f-4da4-b8db-58d798cde480&testMode=true&cors=true&lang=en"
  ).then((res) => res.json());
}

const reqByImg = (url) => {
  return new Promise((resolve) => {
    const img = new Image(1, 1);
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });
};

const postGetVisibility = () => {
  return new Promise((resolve) => {
    window.kaiListeners["viewability"] = resolve;
    window.parent.postMessage(
      JSON.stringify({
        frameID: window.kaiOpts.frameID,
        event: "viewability",
        args: [],
      }),
      window.kaiOpts.appOrigin
    );
  });
};

// Trigger this URL when the Outbrain recommendation is viewed by the user.
// Viewed: The top 1px of the widget is visible in the browser window for a continuous 1 second.
const checkOutbrainVisibleCond = (payload) => {
  let boundingBox = {
    top: payload.args[0],
    left: payload.args[1],
    right: payload.args[2],
    bottom: payload.args[3],
    width: payload.args[4],
    height: payload.args[5],
  };
  let viewport = {
    width: payload.args[6],
    height: payload.args[7],
  };

  return (
    !document.hidden &&
    boundingBox.width !== 0 &&
    boundingBox.height !== 0 &&
    boundingBox.top < viewport.height &&
    boundingBox.top >= 0 &&
    boundingBox.left < viewport.width &&
    boundingBox.right >= 0
  );
};
// Trigger this URL when the Outbrain recommendation is viewed by the user.
// Viewed: The top 1px of the widget is visible in the browser window for a continuous 1 second.
const pollOutbrainViewability = () => {
  let firstVisible = 0; // Timestamp when ad becomes first viewable

  const checkViewable = () => {
    return postGetVisibility()
      .then(checkOutbrainVisibleCond)
      .then((visible) => {
        let now = performance.now();
        if (!visible) {
          firstVisible = 0;
          return { cont: true, callInterval: 2000 };
        }
        if (!firstVisible) {
          firstVisible = now;
          return { cont: true, callInterval: 100 };
        }

        if (now - firstVisible >= 1000) {
          return { cont: false, callInterval: 0 };
        }
        return { cont: true, callInterval: 100 };
      })
      .then(({ cont, callInterval }) => {
        if (!cont) {
          // console.log("Here");
          return true;
        }

        let init = performance.now();
        // let callTimes = 0;
        return new Promise((resolve) => {
          function delay(time) {
            // callTimes++;
            if (time - init >= callInterval) {
              resolve();
            } else {
              setTimeout(() => requestAnimationFrame(delay), callInterval);
            }
          }
          delay(init);
        }).then(() => {
          // console.log(iframe.id, callTimes);
          return checkViewable();
        });
      });
  };
  return checkViewable();
};

getResponse()
  .then((res) => {
    document.getElementById("textTitle").textContent =
      res.response.documents.doc[0].content;
    document.getElementById("textSource").textContent =
      res.response.documents.doc[0].source_display_name;

    const img = document.getElementById("img");
    img.src = res.response.documents.doc[0].thumbnail.url;
    img.style.width = window.kaiOpts.reqWidth + "px";
    img.style.height = window.kaiOpts.reqHeight + "px";

    const imgLink = document.getElementById("imgLink");
    imgLink.href = res.response.documents.doc[0].url;

    const reportServed = res.response.viewability_actions.reportServed;
    reqByImg(reportServed);

    if (res.response.documents.doc[0]["pixels"]) {
      res.response.documents.doc[0]["pixels"].map((url) => reqByImg(url));
    }
    return res;
  })
  .then((res) => {
    return pollOutbrainViewability().then(() => {
      reqByImg(res.response.viewability_actions.reportViewed);
      if (res.response.documents.doc[0]["on-viewed"]) {
        res.response.documents.doc[0]["on-viewed"].map((url) => reqByImg(url));
      }
    });
  });
