const fs = require("fs-extra");
const archiver = require("archiver");
const path = require("path");
const cron = require("node-cron");
const request = require("request");

// Directory to zip
const dirToZip = "/path/to/directory";

// Directory to save the archives
const archiveDir = "./archives";

// URL of the other Express server
const otherServerUrl = "http://example.com/upload";

// Schedule cron job to run once a day at midnight
cron.schedule("0 0 * * *", () => {
  // Get the list of subdirectories in the directory to zip
  const subDirs = fs
    .readdirSync(dirToZip, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  // Get the date of the previous day
  const prevDate = new Date();
  prevDate.setDate(prevDate.getDate() - 1);
  const prevDateString = prevDate.toISOString().split("T")[0];

  // Create a ZIP file for each subdirectory that has files in it
  subDirs.forEach((subDir) => {
    const files = fs.readdirSync(path.join(dirToZip, subDir));
    if (files.length > 0) {
      const output = fs.createWriteStream(
        path.join(archiveDir, `${subDir}_${prevDateString}.zip`)
      );
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });
      archive.pipe(output);
      archive.directory(path.join(dirToZip, subDir), subDir);
      archive.finalize(() => {
        // Delete previous archive file
        const prevArchiveFile = path.join(
          archiveDir,
          `${subDir}_${prevDateString}.zip`
        );
        if (fs.existsSync(prevArchiveFile)) {
          fs.unlinkSync(prevArchiveFile);
        }

        // Send archive to other server
        const formData = {
          archive: {
            value: fs.createReadStream(prevArchiveFile),
            options: {
              filename: `${subDir}_${prevDateString}.zip`,
              contentType: "application/zip",
            },
          },
        };
        request.post(
          {
            url: otherServerUrl,
            formData: formData,
          },
          (err, httpResponse, body) => {
            if (err) {
              console.error(err);
            } else {
              console.log(
                `Archive ${subDir}_${prevDateString}.zip uploaded to ${otherServerUrl}`
              );
            }
          }
        );
      });
    }
  });
});
