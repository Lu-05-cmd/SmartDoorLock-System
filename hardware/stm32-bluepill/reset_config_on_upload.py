import os
import subprocess
from pathlib import Path


Import("env")


def erase_access_config(source, target, env):
    package_dir = env.PioPlatform().get_package_dir("tool-openocd")
    if not package_dir:
        raise RuntimeError("PlatformIO tool-openocd package is not installed")

    package_path = Path(package_dir)
    executable_name = "openocd.exe" if os.name == "nt" else "openocd"
    openocd = package_path / "bin" / executable_name
    scripts = package_path / "openocd" / "scripts"
    if not openocd.is_file() or not scripts.is_dir():
        raise RuntimeError("PlatformIO OpenOCD executable or scripts are missing")

    command = [
        str(openocd),
        "-s",
        str(scripts),
        "-f",
        "interface/stlink.cfg",
        "-f",
        "target/stm32f1x.cfg",
        "-c",
        "init; reset halt; flash erase_address 0x0800FC00 0x400; shutdown",
    ]
    subprocess.run(command, check=True)


env.AddPreAction("upload", erase_access_config)
