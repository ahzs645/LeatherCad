# Native curve editing and transfer

Cubic Bézier records keep separate first and second control points. Ellipse records keep their center, two radii, rotation, start parameter and signed sweep. Their canonical coordinates are millimetres.

The Ellipse tool creates one analytic closed ellipse from its center and radius-extents points. The Cubic Bézier tool takes four points: start, first control, second control and end. The existing three-point quadratic Bézier tool remains available. A collapsed ellipse or cubic is rejected before adding an object.

Native evaluation, hit-point queries, interval trimming, splitting, affine transformations and template stamping retain the analytic primitive. Cubic intervals use de Casteljau subdivision; ellipse intervals retain the same center/radii/rotation with adjusted angular parameters. Extending a line to a native curve uses analytic ellipse intersections or bracketed cubic polynomial roots, including tangent contacts.

The [constraint and dimension engine](NATIVE_CONSTRAINTS.md) supports native chord/major-axis alignment, angles, true curve-length matching, analytic endpoint tangency and ellipse/cubic dimension landmarks. These APIs currently have no production interface callers. Ambiguous, collapsed, protected or nonconvergent combinations report failure with the full final-geometry residual.

**Convert to path** is an explicit approximation: native curves become editable segments within a 0.01 mm geometric tolerance, and the operation reports that conversion. The source is retained when converting a copy. Filled native curves are kept unchanged with guidance to remove the fill first: separate open segments cannot retain their single closed fill. Resource bounds reject overly expensive conversions. This operation is separate from exact native parameter editing.

PDF pattern outlines now retain authored cubic controls instead of fitting replacement circular arcs. Page review still treats stitching, seam matches and folds as inferences that the maker must confirm.

SVG import preserves analytic ellipses/circles and standard `M/L/H/V/C/S/Q/T/A/Z` path geometry, including relative commands and reflected smooth controls. Nested element transforms act on every cubic control and on the ellipse basis; nonuniform scale and skew retain an analytic ellipse. Malformed or unsupported path syntax is rejected for that element with a warning, rather than loading partial path geometry. Compact arc-flag syntax without separators is not supported. Existing document/viewBox unit resolution still applies.

Tests cover independent cubic controls, exact parameter intervals, native trimming, tangent intersections, preserved template stamping, asymmetric PDF controls, relative/smooth SVG controls, rotated arcs and nested transforms. A primitive's presence in the model does not make every historical operation analytic: operations that deliberately flatten geometry must keep their stated tolerance and expose the conversion.
