import click
import json
import drawsvg


ignore_doodad_hash = {
    # Stash
    3230065491,
    # Guild Stash
    139228481,
    # Waypoint
    1224707366,
    # Ziggurat Map Device
    76459657,
    # Relic Locker
    12969733,
    # Reforging Bench
    3263423625,
    # Salvage Bench
    3734046884,
    # Well
    2057229261,
    # Recombinator
    4243958141,
    # Wardrobe Decoration
    2914603195,
    # Alva
    2115859440,
    # Zelina
    1023253651,
    # Zolin
    2204408127,
    # Doryani
    3673653565,
    # Rog
    408811958,
    # Tujen
    1188734792,
    # Dannig
    2939302567,
    # Gwennen
    2230709308,
    # Ange
    2297799330,
}

@click.group()
def main():
    pass


@main.command("hideout_to_svg")
@click.argument("filename")
def hideout_to_svg(filename):
    with open(filename, "rb") as fp:
        data = json.load(fp, object_pairs_hook=tuple)
    data = dict(data)

    points = dict()
    min_x = min_y = 1 << 64
    max_x = max_y = 0
    for doodad_name, doodad_data in data["doodads"]:
        doodad = dict(doodad_data)
        if doodad["hash"] in ignore_doodad_hash:
            continue
        point = doodad["y"], doodad["x"]
        min_x = min(min_x, point[0])
        max_x = max(max_x, point[0])
        min_y = min(min_y, point[1])
        max_y = max(max_y, point[1])
        group = points.setdefault(doodad["hash"], [])
        group.append(point[0])
        group.append(point[1])

    d = drawsvg.Drawing(max_x, max_y, origin=(0, 0))
    for key, group in points.items():
        lines = drawsvg.Lines(
            *group, id=str(key), fill="none", close="true", stroke="#FF8888"
        )
        d.append(lines)
    d.save_svg("test.svg")


if __name__ == "__main__":
    main()
